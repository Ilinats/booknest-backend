import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entity/review.entity';
import { Application } from './entity/application.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Application) private readonly applicationRepo: Repository<Application>,
  ) {}

  async create(readerId: string, dto: CreateReviewDto) {
    const application = await this.applicationRepo.findOne({
      where: { id: dto.applicationId, readerId },
      relations: ['book']
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'approved') {
      throw new ForbiddenException('Can only review approved applications');
    }

    if (application.copyReceivedAt === null) {
      throw new ForbiddenException('Must mark copy as received before submitting review');
    }

    const existingReview = await this.reviewRepo.findOne({
      where: { applicationId: dto.applicationId }
    });

    if (existingReview) {
      throw new ForbiddenException('Review already exists for this application');
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
    application.readingStatus = 'reviewed';
    await this.applicationRepo.save(application);

    return savedReview;
  }

  async findOne(reviewId: string, userId: string, userType?: string) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['application', 'application.reader', 'application.book', 'application.book.author']
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const isReader = review.application.readerId === userId;
    const isAuthor = review.application.book.authorId === userId;
    const isPublic = review.isPublic;

    if (!isReader && !isAuthor && !isPublic) {
      throw new ForbiddenException('Access denied');
    }

    return review;
  }

  /**
   * Update a review. Only the reviewer (reader) who created the review can update it.
   * Only reviewers can control the visibility (isPublic) of their reviews.
   * Authors cannot modify reviews.
   */
  async update(reviewId: string, readerId: string, dto: UpdateReviewDto) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['application']
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Only the reviewer who created the review can update it
    // Authors cannot modify reviews
    if (review.application.readerId !== readerId) {
      throw new ForbiddenException('Can only update your own reviews');
    }

    let wordCount = review.wordCount;
    if (dto.reviewType === 'text' && dto.reviewContent) {
      wordCount = dto.reviewContent.trim().split(/\s+/).length;
    } else if (dto.reviewType === 'link') {
      wordCount = null;
    }

    const updatedReview = this.reviewRepo.merge(review, {
      rating: dto.rating ?? review.rating,
      reviewType: dto.reviewType ?? review.reviewType,
      reviewContent: dto.reviewContent ?? review.reviewContent,
      reviewUrls: dto.reviewUrls ?? review.reviewUrls,
      // Only reviewers can control visibility - authors cannot change this
      isPublic: dto.isPublic ?? review.isPublic,
      wordCount,
    });

    return this.reviewRepo.save(updatedReview);
  }

  /**
   * Remove a review. Only the reviewer (reader) who created the review can delete it.
   * Authors cannot delete reviews from their books.
   */
  async remove(reviewId: string, readerId: string) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['application']
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Only the reviewer who created the review can delete it
    // Authors cannot delete reviews from their books
    if (review.application.readerId !== readerId) {
      throw new ForbiddenException('Can only delete your own reviews');
    }

    await this.reviewRepo.remove(review);

    const application = review.application;
    application.reviewSubmittedAt = null;
    application.readingStatus = 'for_review';
    await this.applicationRepo.save(application);

    return { success: true };
  }

  /**
   * Get reviews for a book.
   * Authors can see all reviews (including private ones) for their own books.
   * Other users can only see public reviews unless includePrivate is true.
   */
  async getBookReviews(bookId: string, includePrivate: boolean = false, userId?: string, userType?: string) {
    // Check if user is the author of this book
    let isAuthor = false;
    if (userType === 'author' && userId) {
      const application = await this.applicationRepo.findOne({
        where: { bookId },
        relations: ['book']
      });
      isAuthor = application?.book?.authorId === userId;
    }

    const query = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.application', 'application')
      .leftJoinAndSelect('application.reader', 'reader')
      .where('application.bookId = :bookId', { bookId });

    // If user is the author, they can see all reviews (including private ones)
    // Otherwise, only show public reviews unless includePrivate is explicitly true
    if (!isAuthor && !includePrivate) {
      query.andWhere('review.isPublic = :isPublic', { isPublic: true });
    }

    query.orderBy('review.createdAt', 'DESC');

    return query.getMany();
  }

  async getUserReviews(userId: string, includePrivate: boolean = true) {
    const query = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.application', 'application')
      .leftJoinAndSelect('application.book', 'book')
      .where('application.readerId = :userId', { userId });

    if (!includePrivate) {
      query.andWhere('review.isPublic = :isPublic', { isPublic: true });
    }

    query.orderBy('review.createdAt', 'DESC');

    return query.getMany();
  }

  async getFeaturedReviews(limit: number = 10) {
    return this.reviewRepo.find({
      where: { isFeatured: true, isPublic: true },
      relations: ['application', 'application.reader', 'application.book'],
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  async featureReview(reviewId: string, authorId: string, userType?: string) {
    if (userType !== 'author') {
      throw new ForbiddenException('Author access required');
    }

    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['application', 'application.book']
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.application.book.authorId !== authorId) {
      throw new ForbiddenException('Can only feature reviews for your own books');
    }

    review.isFeatured = true;
    return this.reviewRepo.save(review);
  }

  async unfeatureReview(reviewId: string, authorId: string, userType?: string) {
    if (userType !== 'author') {
      throw new ForbiddenException('Author access required');
    }

    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['application', 'application.book']
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.application.book.authorId !== authorId) {
      throw new ForbiddenException('Can only unfeature reviews for your own books');
    }

    review.isFeatured = false;
    return this.reviewRepo.save(review);
  }
}
