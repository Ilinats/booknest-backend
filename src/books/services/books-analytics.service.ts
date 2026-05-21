import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../entity/book.entity';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { BookErrors } from '../errors/book-errors';
import { ApplicationStatus } from '../../applications/enums';
import {
  BooksAnalyticsBookQueriesHelper,
  percent,
} from '../helpers/books-analytics-book-queries.helper';
import { BooksAnalyticsAuthorQueriesHelper } from '../helpers/books-analytics-author-queries.helper';
import { AnalyticsCacheService } from '../../common/cache/analytics-cache.service';

@Injectable()
export class BooksAnalyticsService {
  private readonly logger = new Logger(BooksAnalyticsService.name);

  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    private readonly bookQueries: BooksAnalyticsBookQueriesHelper,
    private readonly authorQueries: BooksAnalyticsAuthorQueriesHelper,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async stats(bookId: string) {
    return this.analyticsCache.getOrSet(`book-stats:${bookId}`, () =>
      this.loadStats(bookId),
    );
  }

  private async loadStats(bookId: string) {
    const startOfMonth = new Date(0);

    const [book, applicationCounts, reviewStats] = await Promise.all([
      this.bookRepo.findOne({ where: { id: bookId } }),
      this.bookQueries.getApplicationCounts(bookId, startOfMonth),
      this.bookQueries.getReviewStats(bookId),
    ]);

    if (!book) {
      throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
    }

    const approvedReaders = applicationCounts.approved;
    const expectedAvailableCopies = Math.max(
      0,
      book.totalCopies - approvedReaders,
    );
    const availableCopiesMismatch =
      book.availableCopies !== expectedAvailableCopies;

    if (availableCopiesMismatch) {
      this.logger.warn(
        `availableCopies mismatch for book ${bookId}: stored=${book.availableCopies}, expected=${expectedAvailableCopies} (totalCopies=${book.totalCopies}, approved=${approvedReaders})`,
      );
    }

    return {
      bookId,
      totalApplications: applicationCounts.total,
      pendingApplications: applicationCounts.pending,
      approvedApplications: applicationCounts.approved,
      rejectedApplications: applicationCounts.rejected,
      withdrawnApplications: applicationCounts.withdrawn,
      approvedReaders,
      availableCopies: book.availableCopies,
      expectedAvailableCopies,
      availableCopiesMismatch,
      reviewsSubmitted: reviewStats.totalReviews,
      averageRating: reviewStats.averageRating,
    };
  }

  async getBookAnalytics(bookId: string) {
    return this.analyticsCache.getOrSet(`book:${bookId}`, () =>
      this.loadBookAnalytics(bookId),
    );
  }

  private async loadBookAnalytics(bookId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      book,
      applicationCounts,
      reviewStats,
      recentReviews,
      averageResponseTime,
      averageReviewTime,
      readerInsights,
    ] = await Promise.all([
      this.bookRepo.findOne({
        where: { id: bookId },
        relations: ['author'],
      }),
      this.bookQueries.getApplicationCounts(bookId, startOfMonth),
      this.bookQueries.getReviewStats(bookId),
      this.bookQueries.getRecentReviews(bookId, 5),
      this.bookQueries.getBookAverageResponseTime(bookId),
      this.bookQueries.getBookAverageReviewTime(bookId),
      this.bookQueries.getBookReaderInsights(bookId),
    ]);

    if (!book) {
      throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
    }

    const {
      total: totalApplications,
      approved: approvedApplications,
      pending: pendingApplications,
      rejected: rejectedApplications,
      withdrawn: withdrawnApplications,
      thisMonth,
    } = applicationCounts;

    const reviewRate = percent(reviewStats.totalReviews, approvedApplications);

    return {
      bookId,
      book: {
        id: book.id,
        title: book.title,
        coverImageUrl: book.coverImageUrl,
        status: book.status,
        author: {
          id: book.author.id,
          firstName: book.author.firstName,
          lastName: book.author.lastName,
          username: book.author.username,
        },
      },
      summary: {
        totalApplications,
        pendingApplications,
        approvedApplications,
        rejectedApplications,
        withdrawnApplications,
        totalReviews: reviewStats.totalReviews,
        averageRating: reviewStats.averageRating,
        positiveFeedback: reviewStats.positiveFeedback,
      },
      reviewStatistics: {
        totalReviews: reviewStats.totalReviews,
        averageRating: reviewStats.averageRating.toFixed(1),
        positiveFeedback: reviewStats.positiveFeedback,
        ratingDistribution: reviewStats.ratingDistribution,
        ratingBreakdown: toRatingBreakdown(reviewStats.ratingDistribution),
        reviewTypes: reviewStats.reviewTypes,
        averageWordCount: reviewStats.averageWordCount,
      },
      applicationStatistics: {
        totalApplications,
        pendingApplications,
        approvedApplications,
        rejectedApplications,
        withdrawnApplications,
        applicationsThisMonth: thisMonth.total,
        approvedApplicationsThisMonth: thisMonth.approved,
        rejectedApplicationsThisMonth: thisMonth.rejected,
        approvalRate: percent(approvedApplications, totalApplications),
        rejectionRate: percent(rejectedApplications, totalApplications),
        averageResponseTime,
        applicationConversionRate: percent(
          approvedApplications,
          totalApplications,
        ),
      },
      reviewPerformance: {
        reviewSubmissionRate: reviewRate,
        reviewCompletionRate: reviewRate,
        averageReviewTime,
        averageWordCount: reviewStats.averageWordCount,
      },
      recentReviews,
      readerInsights,
    };
  }

  async getAuthorAnalytics(authorId: string, dateRange?: string) {
    const rangeKey = dateRange?.trim() || 'all';
    return this.analyticsCache.getOrSet(
      `author:${authorId}:${rangeKey}`,
      () => this.loadAuthorAnalytics(authorId, dateRange),
    );
  }

  private async loadAuthorAnalytics(authorId: string, dateRange?: string) {
    const { startDate } = this.authorQueries.getDateRange(dateRange);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const reviewCountQuery = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true });

    if (startDate) {
      reviewCountQuery.andWhere('review.createdAt >= :startDate', {
        startDate,
      });
    }

    const [
      bookCounts,
      applicationCounts,
      totalReviews,
      averageRating,
      booksWithReviews,
      topPerformingBooks,
      averageResponseTime,
      readerAnalytics,
      monthlyApplications,
      monthlyReviews,
      approvalRateOverTime,
      ratingDistribution,
    ] = await Promise.all([
      this.authorQueries.getBookStatusCounts(authorId),
      this.authorQueries.getApplicationOverview(
        authorId,
        startDate,
        startOfMonth,
      ),
      reviewCountQuery.getCount(),
      this.authorQueries.getAuthorAverageRating(authorId, startDate),
      this.authorQueries.getBooksWithReviews(authorId),
      this.authorQueries.getTopPerformingBooks(authorId, 5),
      this.authorQueries.getAuthorAverageResponseTime(authorId),
      this.authorQueries.getReaderAnalytics(authorId, startOfMonth),
      this.authorQueries.getMonthlyApplications(authorId, startDate),
      this.authorQueries.getMonthlyReviews(authorId, startDate),
      this.authorQueries.getApprovalRateOverTime(authorId, startDate),
      this.authorQueries.getAuthorRatingDistribution(authorId),
    ]);

    const {
      total: totalApplications,
      approved: approvedApplications,
      pending: pendingApplications,
      rejected: rejectedApplications,
      thisMonth: applicationsThisMonth,
    } = applicationCounts;

    return {
      authorId,
      overview: {
        totalBooks: bookCounts.total,
        publishedBooks: bookCounts.published,
        draftBooks: bookCounts.draft,
        inProgressBooks: bookCounts.inProgress,
        completedBooks: bookCounts.completed,
        totalApplications,
        approvedApplications,
        pendingApplications,
        rejectedApplications,
        applicationsThisMonth,
        totalReviews,
        averageRating,
        overallApprovalRate: percent(approvedApplications, totalApplications),
        rejectionRate: percent(rejectedApplications, totalApplications),
        averageResponseTime,
      },
      performance: {
        booksWithReviews,
        averageRating,
        topPerformingBooks,
      },
      readerAnalytics,
      trends: {
        monthlyApplications,
        monthlyReviews,
        approvalRateOverTime,
      },
      ratingDistribution,
    };
  }

  async getBookPerformanceComparison(authorId: string) {
    return this.analyticsCache.getOrSet(`performance:${authorId}`, () =>
      this.loadBookPerformanceComparison(authorId),
    );
  }

  private async loadBookPerformanceComparison(authorId: string) {
    const books = await this.bookRepo.find({
      where: { authorId },
      relations: ['bookGenres', 'bookGenres.genre'],
    });

    const bookIds = books.map((book) => book.id);

    if (bookIds.length === 0) {
      return [];
    }

    const applications = await this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .select('book.id', 'bookId')
      .addSelect('COUNT(application.id)', 'totalApplications')
      .addSelect(
        'SUM(CASE WHEN application.status = :approved THEN 1 ELSE 0 END)',
        'approvedApplications',
      )
      .where('book.id IN (:...bookIds)', { bookIds })
      .setParameter('approved', ApplicationStatus.APPROVED)
      .groupBy('book.id')
      .getRawMany();

    const reviews = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('book.id', 'bookId')
      .addSelect('AVG(review.rating)', 'averageRating')
      .addSelect('COUNT(review.id)', 'reviewCount')
      .where('book.id IN (:...bookIds)', { bookIds })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .groupBy('book.id')
      .getRawMany();

    const applicationMap = new Map(
      applications.map((app) => [
        app.bookId,
        {
          totalApplications: parseInt(app.totalApplications || '0', 10),
          approvedApplications: parseInt(app.approvedApplications || '0', 10),
        },
      ]),
    );

    const reviewMap = new Map(
      reviews.map((review) => [
        review.bookId,
        {
          averageRating: parseFloat(review.averageRating || '0'),
          reviewCount: parseInt(review.reviewCount || '0', 10),
        },
      ]),
    );

    return books.map((book) => {
      const appStats = applicationMap.get(book.id) || {
        totalApplications: 0,
        approvedApplications: 0,
      };
      const reviewStats = reviewMap.get(book.id) || {
        averageRating: 0,
        reviewCount: 0,
      };

      return {
        bookId: book.id,
        title: book.title,
        coverImageUrl: book.coverImageUrl,
        status: book.status,
        genres: (book.bookGenres || []).map((bg) => ({
          id: bg.genre.id,
          name: bg.genre.name,
        })),
        applications: appStats,
        reviews: reviewStats,
        approvalRate: percent(
          appStats.approvedApplications,
          appStats.totalApplications,
        ),
      };
    });
  }
}

function toRatingBreakdown(distribution: Record<1 | 2 | 3 | 4 | 5, number>) {
  return ([5, 4, 3, 2, 1] as const).map((rating) => ({
    rating,
    count: distribution[rating] || 0,
  }));
}
