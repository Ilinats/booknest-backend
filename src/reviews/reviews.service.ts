import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Book } from '../books/entity/book.entity';
import { Review } from './entity/review.entity';
import { Application } from '../applications/entity/application.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { FindReviewsDto } from './dto/find-reviews.dto';
import { createPaginatedResponse, sanitizeBookForUser } from '../common';
import { ReadingStatus, ApplicationStatus } from '../applications/enums';
import { UserType } from '../users/enums';
import { ReviewErrorCode } from './errors';
import { UserActivityService } from '../user-activity/user-activity.service';
import { ReviewType } from './enums';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @Optional()
    @Inject(forwardRef(() => UserActivityService))
    private readonly userActivityService?: UserActivityService,
  ) {}

  async create(readerId: string, dto: CreateReviewDto): Promise<Review> {
    const application = await this.applicationRepo.findOne({
      where: { id: dto.applicationId, readerId },
      relations: ['book'],
    });

    if (!application) {
      throw new NotFoundException(ReviewErrorCode.APPLICATION_NOT_FOUND);
    }

    if (application.status !== ApplicationStatus.APPROVED) {
      throw new ForbiddenException(ReviewErrorCode.APPLICATION_NOT_APPROVED);
    }

    const existingReview = await this.reviewRepo.findOne({
      where: {
        applicationId: dto.applicationId,
        application: { readerId },
      },
      relations: ['application'],
    });

    if (existingReview) {
      throw new ForbiddenException(ReviewErrorCode.REVIEW_ALREADY_EXISTS);
    }

    const wordCount = this.calculateWordCount(
      dto.reviewType,
      dto.reviewContent,
    );

    const review = this.reviewRepo.create({
      applicationId: dto.applicationId,
      rating: dto.rating,
      reviewType: dto.reviewType,
      reviewContent: dto.reviewContent ?? null,
      reviewUrls: dto.reviewUrls ?? null,
      isPublic: dto.isPublic ?? true,
      wordCount,
    });

    const savedReview = await this.reviewRepo.save(review);

    await this.markApplicationReviewed(application);

    if (this.userActivityService) {
      try {
        await this.userActivityService.logReviewPosted(
          readerId,
          application.bookId,
          application.id,
          dto.rating,
        );
      } catch (error) {
        this.logger.error(
          `Failed to log review posted activity: ${error}`,
          error?.stack,
        );
      }
    }

    return savedReview;
  }

  async findUserReviewForBook(
    bookId: string,
    userId: string,
  ): Promise<Review | null> {
    const review = await this.reviewRepo.findOne({
      where: {
        application: {
          bookId,
          readerId: userId,
        },
      },
      relations: ['application', 'application.book', 'application.reader'],
    });

    if (review?.application?.book) {
      review.application.book = this.sanitizeBookInReviewContext(
        review.application.book,
      );
    }

    return review;
  }

  async findOne(reviewId: string, userId?: string): Promise<Review> {
    const review = await this.findReviewOrThrow(reviewId, [
      'application',
      'application.reader',
      'application.book',
      'application.book.author',
    ]);

    const isReader = userId && review.application.readerId === userId;
    const isAuthor = userId && review.application.book.authorId === userId;
    const isPublic = review.isPublic;

    if (!isReader && !isAuthor && !isPublic) {
      throw new ForbiddenException(ReviewErrorCode.ACCESS_DENIED);
    }

    if (!isAuthor && review.application.book) {
      review.application.book = this.sanitizeBookInReviewContext(
        review.application.book,
      );
    }

    return review;
  }

  async update(
    reviewId: string,
    userId: string,
    userType: UserType | undefined,
    dto: UpdateReviewDto,
  ): Promise<Review> {
    const review = await this.findReviewOrThrow(reviewId, [
      'application',
      'application.book',
    ]);

    const isReader = review.application.readerId === userId;

    if (
      dto.rating !== undefined ||
      dto.reviewType !== undefined ||
      dto.reviewContent !== undefined ||
      dto.reviewUrls !== undefined ||
      dto.isPublic !== undefined
    ) {
      if (!isReader) {
        throw new ForbiddenException(ReviewErrorCode.ACCESS_DENIED);
      }

      const wordCount = this.calculateWordCount(
        dto.reviewType ?? review.reviewType,
        dto.reviewContent ?? review.reviewContent ?? undefined,
      );

      review.rating = dto.rating ?? review.rating;
      review.reviewType = dto.reviewType ?? review.reviewType;
      review.reviewContent = dto.reviewContent ?? review.reviewContent;
      review.reviewUrls = dto.reviewUrls ?? review.reviewUrls;
      review.isPublic = dto.isPublic ?? review.isPublic;
      review.wordCount = wordCount;
    }

    return this.reviewRepo.save(review);
  }

  async remove(reviewId: string, readerId: string): Promise<void> {
    const review = await this.findReviewOrThrow(reviewId, ['application']);

    this.assertReviewReader(review, readerId);

    await this.reviewRepo.remove(review);
    await this.clearApplicationAfterReviewRemoved(review.application);
  }

  async getBookReviews(
    bookId: string,
    dto: FindReviewsDto,
    userId: string,
    userType?: UserType,
  ) {
    const isAuthor = await this.isBookAuthor(bookId, userId, userType);
    const skip = dto.skip ?? 0;
    const take = dto.take ?? 20;

    const query = this.buildReviewsQuery()
      .leftJoinAndSelect('application.reader', 'reader')
      .where('application.bookId = :bookId', { bookId });

    this.applyBookReviewsVisibilityFilter(query, isAuthor, userId);

    const [reviews, total] = await this.paginateReviews(query, skip, take);

    const sanitizedReviews = reviews.map((review) =>
      this.sanitizeReviewBookForUser(review, userId, userType),
    );

    return createPaginatedResponse(sanitizedReviews, total, skip, take);
  }

  async getUserReviews(
    userId: string,
    dto: FindReviewsDto,
  ): Promise<ReturnType<typeof createPaginatedResponse<Review>>> {
    const skip = dto.skip ?? 0;
    const take = dto.take ?? 20;
    const includePrivate = dto.includePrivate ?? true;

    const query = this.buildReviewsQuery()
      .leftJoinAndSelect('application.book', 'book')
      .where('application.readerId = :userId', { userId });

    if (!includePrivate) {
      query.andWhere('review.isPublic = :isPublic', { isPublic: true });
    }

    const [reviews, total] = await this.paginateReviews(query, skip, take);

    const sanitizedReviews = reviews.map((review) =>
      this.sanitizeReviewBook(review),
    );

    return createPaginatedResponse(sanitizedReviews, total, skip, take);
  }

  async getAuthorLatestReviews(
    authorId: string,
    limit: number = 3,
  ): Promise<Review[]> {
    return this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.application', 'application')
      .leftJoinAndSelect('application.reader', 'reader')
      .leftJoinAndSelect('application.book', 'book')
      .where('book.authorId = :authorId', { authorId })
      .orderBy('review.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  private async isBookAuthor(
    bookId: string,
    userId?: string,
    userType?: UserType,
  ): Promise<boolean> {
    if (userType !== UserType.AUTHOR || !userId) {
      return false;
    }

    const book = await this.bookRepo.findOne({
      where: { id: bookId, authorId: userId },
    });

    return book !== null;
  }

  private applyBookReviewsVisibilityFilter(
    query: SelectQueryBuilder<Review>,
    isAuthor: boolean,
    userId: string,
  ): void {
    if (isAuthor) {
      return;
    }

    query.andWhere(
      '(review.isPublic = :isPublic OR application.readerId = :userId)',
      { isPublic: true, userId },
    );
  }

  private async findReviewOrThrow(
    reviewId: string,
    relations: string[],
  ): Promise<Review> {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations,
    });

    if (!review) {
      throw new NotFoundException(ReviewErrorCode.REVIEW_NOT_FOUND);
    }

    return review;
  }

  private assertReviewReader(review: Review, readerId: string): void {
    if (review.application.readerId !== readerId) {
      throw new ForbiddenException(ReviewErrorCode.ACCESS_DENIED);
    }
  }

  private async markApplicationReviewed(
    application: Application,
  ): Promise<void> {
    application.reviewSubmittedAt = new Date();
    application.readingStatus = ReadingStatus.REVIEWED;
    if (!application.readingCompletedAt) {
      application.readingCompletedAt = new Date();
    }
    await this.applicationRepo.save(application);
  }

  private async clearApplicationAfterReviewRemoved(
    application: Application,
  ): Promise<void> {
    application.reviewSubmittedAt = null;
    application.readingStatus = ReadingStatus.FOR_REVIEW;
    application.status = ApplicationStatus.APPROVED;
    await this.applicationRepo.save(application);
  }

  private buildReviewsQuery(): SelectQueryBuilder<Review> {
    return this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.application', 'application')
      .orderBy('review.createdAt', 'DESC');
  }

  private async paginateReviews(
    query: SelectQueryBuilder<Review>,
    skip: number,
    take: number,
  ): Promise<[Review[], number]> {
    return query.skip(skip).take(take).getManyAndCount();
  }

  private calculateWordCount(
    reviewType: ReviewType,
    reviewContent?: string,
  ): number | null {
    if (reviewType === ReviewType.TEXT && reviewContent) {
      return reviewContent.trim().split(/\s+/).length;
    }

    if (reviewType === ReviewType.LINK) {
      return null;
    }

    return null;
  }

  private sanitizeBookInReviewContext(
    book: Book,
    userId?: string,
    userType?: UserType,
  ): Book {
    return sanitizeBookForUser(book, userId, userType, false);
  }

  private sanitizeReviewBook(review: Review): Review {
    if (review.application?.book) {
      review.application.book = this.sanitizeBookInReviewContext(
        review.application.book,
      );
    }

    return review;
  }

  private sanitizeReviewBookForUser(
    review: Review,
    userId?: string,
    userType?: UserType,
  ): Review {
    if (!review.application?.book) {
      return review;
    }

    review.application.book = this.sanitizeBookInReviewContext(
      review.application.book,
      userId,
      userType,
    );

    return review;
  }
}
