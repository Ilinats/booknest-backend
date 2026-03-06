import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  Optional,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entity/review.entity';
import { Application } from '../applications/entity/application.entity';
import { Book } from '../books/entity/book.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { FindReviewsDto } from './dto/find-reviews.dto';
import { createPaginatedResponse } from '../common';
import { ReadingStatus, ApplicationStatus } from '../applications/enums';
import { UserType } from '../users/enums';
import { ReviewErrorCode } from './errors';
import { UserActivityService } from '../user-activity/user-activity.service';

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

  async create(readerId: string, dto: CreateReviewDto) {
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

    let wordCount: number | null = null;
    if (dto.reviewType === 'text' && dto.reviewContent) {
      wordCount = dto.reviewContent.trim().split(/\s+/).length;
    }

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

    application.reviewSubmittedAt = new Date();
    application.readingStatus = ReadingStatus.REVIEWED;
    await this.applicationRepo.save(application);

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
      const sanitizedBook = { ...review.application.book };
      delete sanitizedBook.fileUrl;
      delete sanitizedBook.fileSize;
      delete sanitizedBook.fileType;
      review.application.book = sanitizedBook as any;
    }

    return review;
  }

  async findOne(reviewId: string, userId?: string) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: [
        'application',
        'application.reader',
        'application.book',
        'application.book.author',
      ],
    });

    if (!review) {
      throw new NotFoundException(ReviewErrorCode.REVIEW_NOT_FOUND);
    }

    const isReader = userId && review.application.readerId === userId;
    const isAuthor = userId && review.application.book.authorId === userId;
    const isPublic = review.isPublic;

    if (!isReader && !isAuthor && !isPublic) {
      throw new ForbiddenException(ReviewErrorCode.ACCESS_DENIED);
    }

    if (!isAuthor && review.application.book) {
      const sanitizedBook = { ...review.application.book };
      delete sanitizedBook.fileUrl;
      delete sanitizedBook.fileSize;
      delete sanitizedBook.fileType;
      review.application.book = sanitizedBook as any;
    }

    return review;
  }

  async update(
    reviewId: string,
    userId: string,
    userType: UserType | undefined,
    dto: UpdateReviewDto,
  ) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['application', 'application.book'],
    });

    if (!review) {
      throw new NotFoundException(ReviewErrorCode.REVIEW_NOT_FOUND);
    }

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

      let wordCount = review.wordCount;
      if (dto.reviewType === 'text' && dto.reviewContent) {
        wordCount = dto.reviewContent.trim().split(/\s+/).length;
      } else if (dto.reviewType === 'link') {
        wordCount = null;
      }

      review.rating = dto.rating ?? review.rating;
      review.reviewType = dto.reviewType ?? review.reviewType;
      review.reviewContent = dto.reviewContent ?? review.reviewContent;
      review.reviewUrls = dto.reviewUrls ?? review.reviewUrls;
      review.isPublic = dto.isPublic ?? review.isPublic;
      review.wordCount = wordCount;
    }

    return this.reviewRepo.save(review);
  }

  async remove(reviewId: string, readerId: string) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['application'],
    });

    if (!review) {
      throw new NotFoundException(ReviewErrorCode.REVIEW_NOT_FOUND);
    }

    if (review.application.readerId !== readerId) {
      throw new ForbiddenException(ReviewErrorCode.ACCESS_DENIED);
    }

    await this.reviewRepo.remove(review);

    const application = review.application;
    application.reviewSubmittedAt = null;
    application.readingStatus = ReadingStatus.FOR_REVIEW;
    await this.applicationRepo.save(application);
  }

  async getBookReviews(
    bookId: string,
    dto: FindReviewsDto,
    userId?: string,
    userType?: string,
  ) {
    let isAuthor = false;
    if (userType === 'author' && userId) {
      const book = await this.bookRepo.findOne({
        where: { id: bookId, authorId: userId },
      });
      isAuthor = book !== null;
    }

    const skip = dto.skip ?? 0;
    const take = dto.take ?? 20;
    const includePrivate = dto.includePrivate ?? false;

    const query = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.application', 'application')
      .leftJoinAndSelect('application.reader', 'reader')
      .where('application.bookId = :bookId', { bookId });

    if (!isAuthor && !includePrivate) {
      query.andWhere('review.isPublic = :isPublic', { isPublic: true });
    }

    query.orderBy('review.createdAt', 'DESC');

    const [reviews, total] = await query
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const sanitizedReviews = reviews.map((review) => {
      if (review.application?.book) {
        const bookAuthorId = review.application.book.authorId;
        const isAuthor =
          userId && userType === 'author' && bookAuthorId === userId;

        if (!isAuthor && review.application.book) {
          const sanitizedBook = { ...review.application.book };
          delete sanitizedBook.fileUrl;
          delete sanitizedBook.fileSize;
          delete sanitizedBook.fileType;
          review.application.book = sanitizedBook as any;
        }
      }
      return review;
    });

    return createPaginatedResponse(sanitizedReviews, total, skip, take);
  }

  async getUserReviews(userId: string, dto: FindReviewsDto) {
    const skip = dto.skip ?? 0;
    const take = dto.take ?? 20;
    const includePrivate = dto.includePrivate ?? true;

    const query = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.application', 'application')
      .leftJoinAndSelect('application.book', 'book')
      .where('application.readerId = :userId', { userId });

    if (!includePrivate) {
      query.andWhere('review.isPublic = :isPublic', { isPublic: true });
    }

    query.orderBy('review.createdAt', 'DESC');

    const [reviews, total] = await query
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const sanitizedReviews = reviews.map((review) => {
      if (review.application?.book) {
        const sanitizedBook = { ...review.application.book };
        delete sanitizedBook.fileUrl;
        delete sanitizedBook.fileSize;
        delete sanitizedBook.fileType;
        review.application.book = sanitizedBook as any;
      }
      return review;
    });

    return createPaginatedResponse(sanitizedReviews, total, skip, take);
  }

  async getAuthorLatestReviews(
    authorId: string,
    limit: number = 3,
  ): Promise<Review[]> {
    return await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.application', 'application')
      .leftJoinAndSelect('application.reader', 'reader')
      .leftJoinAndSelect('application.book', 'book')
      .where('book.authorId = :authorId', { authorId })
      .orderBy('review.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }
}
