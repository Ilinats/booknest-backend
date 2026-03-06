import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In, Not, IsNull } from 'typeorm';
import { Book } from '../entity/book.entity';
import { BookStatus } from '../enums';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { User } from '../../users/entity/user.entity';
import { UserAddress } from '../../user-address/entity/user-address.entity';
import { UserGenrePreference } from '../../user-genre-preferences/entity/user-genre-preference.entity';
import { BookGenre } from '../entity/book-genre.entity';
import { BookErrorCode, BookErrors } from '../errors/book-errors';
import { ApplicationStatus } from '../../applications/enums';

@Injectable()
export class BooksAnalyticsService {
  private readonly logger = new Logger(BooksAnalyticsService.name);

  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepo: Repository<UserAddress>,
    @InjectRepository(UserGenrePreference)
    private readonly userGenrePrefRepo: Repository<UserGenrePreference>,
    @InjectRepository(BookGenre)
    private readonly bookGenreRepo: Repository<BookGenre>,
  ) {}

  async stats(authorId: string, bookId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }
    if (book.authorId !== authorId) {
      const error = BookErrors[BookErrorCode.BOOK_CANNOT_MODIFY_OTHERS];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    const [totalApplicants, approvedReaders] = await Promise.all([
      this.applicationRepo.count({
        where: { bookId },
      }),
      this.applicationRepo.count({
        where: { bookId, status: ApplicationStatus.APPROVED },
      }),
    ]);

    const oldAvailableCopies = book.availableCopies;
    const correctAvailableCopies = Math.max(
      0,
      book.totalCopies - approvedReaders,
    );

    if (oldAvailableCopies !== correctAvailableCopies) {
      book.availableCopies = correctAvailableCopies;
      await this.bookRepo.save(book);
      this.logger.warn(
        `Fixed availableCopies for book ${bookId}: was ${oldAvailableCopies}, now ${correctAvailableCopies}`,
      );
    }

    return { bookId, totalApplicants, approvedReaders };
  }

  async analytics(authorId: string, bookId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }
    if (book.authorId !== authorId) {
      const error = BookErrors[BookErrorCode.BOOK_CANNOT_MODIFY_OTHERS];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    return this.getBookAnalytics(bookId);
  }

  async getBookAnalytics(bookId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const book = await this.bookRepo.findOne({
      where: { id: bookId },
      relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
    });

    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    const [
      totalApplications,
      approvedApplications,
      pendingApplications,
      rejectedApplications,
      totalReviews,
      reviews,
      averageRating,
      ratingDistribution,
      reviewTypes,
      averageWordCount,
      recentReviews,
      applicationsThisMonth,
      approvedApplicationsThisMonth,
      rejectedApplicationsThisMonth,
      averageResponseTime,
      averageReviewTime,
      reviewSubmissionRate,
      applicationConversionRate,
      reviewCompletionRate,
    ] = await Promise.all([
      this.applicationRepo.count({ where: { bookId } }),
      this.applicationRepo.count({
        where: { bookId, status: ApplicationStatus.APPROVED },
      }),
      this.applicationRepo.count({
        where: { bookId, status: ApplicationStatus.PENDING },
      }),
      this.applicationRepo.count({
        where: { bookId, status: ApplicationStatus.REJECTED },
      }),
      this.reviewRepo.count({
        where: {
          application: { bookId },
        },
      }),
      this.reviewRepo.find({
        where: {
          application: { bookId },
        },
        relations: ['application', 'application.reader'],
      }),
      this.getAverageRating(bookId),
      this.getRatingDistribution(bookId),
      this.getReviewTypes(bookId),
      this.getAverageWordCount(bookId),
      this.getRecentReviews(bookId, 5),
      this.getBookApplicationsThisMonth(bookId, startOfMonth),
      this.getBookApprovedApplicationsThisMonth(bookId, startOfMonth),
      this.getBookRejectedApplicationsThisMonth(bookId, startOfMonth),
      this.getBookAverageResponseTime(bookId),
      this.getBookAverageReviewTime(bookId),
      this.getReviewSubmissionRate(bookId),
      this.getApplicationConversionRate(bookId),
      this.getReviewCompletionRate(bookId),
    ]);

    const positiveFeedback =
      reviews.length > 0
        ? Math.round(
            (reviews.filter((r) => r.rating >= 4).length / reviews.length) *
              100,
          )
        : 0;

    const ratingBreakdown = [
      { rating: 5, count: ratingDistribution[5] || 0 },
      { rating: 4, count: ratingDistribution[4] || 0 },
      { rating: 3, count: ratingDistribution[3] || 0 },
      { rating: 2, count: ratingDistribution[2] || 0 },
      { rating: 1, count: ratingDistribution[1] || 0 },
    ];

    const applications = await this.applicationRepo.find({
      where: { bookId },
      relations: ['reader'],
      select: {
        id: true,
        readerId: true,
        reader: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          birthDate: true,
        },
      },
    });

    const readerIds = applications.map((app) => app.readerId);
    const uniqueReaderIds = [...new Set(readerIds)];

    const addresses =
      uniqueReaderIds.length > 0
        ? await this.userAddressRepo.find({
            where: {
              userId: In(uniqueReaderIds),
              isPrimary: true,
            },
            select: {
              userId: true,
              country: true,
            },
          })
        : [];

    const genrePreferences =
      uniqueReaderIds.length > 0
        ? await this.userGenrePrefRepo.find({
            where: {
              user: { id: In(uniqueReaderIds) },
            },
            relations: ['genre'],
            select: {
              user: {
                id: true,
              },
              genre: {
                id: true,
                name: true,
              },
            },
          })
        : [];

    const readers =
      uniqueReaderIds.length > 0
        ? await this.userRepo.find({
            where: { id: In(uniqueReaderIds) },
            select: {
              id: true,
              birthDate: true,
            },
          })
        : [];

    const ageData = this.calculateAgeDemographics(readers);
    const countryBreakdown = this.calculateCountryBreakdown(
      addresses,
      uniqueReaderIds.length,
    );
    const genrePreferencesBreakdown = this.calculateGenreBreakdown(
      genrePreferences,
      uniqueReaderIds.length,
    );

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
        approvedApplications,
        pendingApplications,
        rejectedApplications,
        totalReviews,
        averageRating,
        positiveFeedback,
      },
      reviewStatistics: {
        totalReviews,
        averageRating: averageRating.toFixed(1),
        positiveFeedback,
        ratingDistribution: ratingDistribution,
        ratingBreakdown: ratingBreakdown,
        reviewTypes,
        averageWordCount,
      },
      applicationStatistics: {
        totalApplications,
        approvedApplications,
        pendingApplications,
        rejectedApplications,
        applicationsThisMonth,
        approvedApplicationsThisMonth,
        rejectedApplicationsThisMonth,
        approvalRate:
          totalApplications > 0
            ? Math.round((approvedApplications / totalApplications) * 100)
            : 0,
        rejectionRate:
          totalApplications > 0
            ? Math.round((rejectedApplications / totalApplications) * 100)
            : 0,
        averageResponseTime,
        applicationConversionRate,
      },
      reviewPerformance: {
        reviewSubmissionRate,
        reviewCompletionRate,
        averageReviewTime,
        averageWordCount,
      },
      recentReviews,
      readerInsights: {
        totalApplicants: uniqueReaderIds.length,
        demographics: {
          age: ageData,
          countries: countryBreakdown,
          genrePreferences: genrePreferencesBreakdown,
        },
      },
    };
  }

  async getAuthorAnalytics(authorId: string, dateRange?: string) {
    const { startDate } = this.getDateRange(dateRange);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const applicationCountQuery = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .where('book.authorId = :authorId', { authorId });

    const reviewCountQuery = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true });

    if (startDate) {
      applicationCountQuery.andWhere('application.appliedAt >= :startDate', {
        startDate,
      });
      reviewCountQuery.andWhere('review.createdAt >= :startDate', {
        startDate,
      });
    }

    const [
      totalBooks,
      publishedBooks,
      totalApplications,
      approvedApplications,
      pendingApplications,
      rejectedApplications,
      applicationsThisMonth,
      totalReviews,
      averageRating,
      booksWithReviews,
      topPerformingBooks,
      averageResponseTime,
    ] = await Promise.all([
      this.bookRepo.count({ where: { authorId } }),
      this.bookRepo.count({ where: { authorId, status: BookStatus.ACTIVE } }),
      applicationCountQuery.getCount(),
      applicationCountQuery
        .clone()
        .andWhere('application.status = :status', {
          status: ApplicationStatus.APPROVED,
        })
        .getCount(),
      applicationCountQuery
        .clone()
        .andWhere('application.status = :status', {
          status: ApplicationStatus.PENDING,
        })
        .getCount(),
      applicationCountQuery
        .clone()
        .andWhere('application.status = :status', {
          status: ApplicationStatus.REJECTED,
        })
        .getCount(),
      this.applicationRepo.count({
        where: {
          book: { authorId },
          appliedAt: MoreThanOrEqual(startOfMonth),
        },
      }),
      reviewCountQuery.getCount(),
      this.getAuthorAverageRating(authorId, startDate),
      this.getBooksWithReviews(authorId),
      this.getTopPerformingBooks(authorId, 5),
      this.getAuthorAverageResponseTime(authorId),
    ]);

    const overallApprovalRate =
      totalApplications > 0
        ? Math.round((approvedApplications / totalApplications) * 100)
        : 0;

    const rejectionRate =
      totalApplications > 0
        ? Math.round((rejectedApplications / totalApplications) * 100)
        : 0;

    const readerAnalytics = await this.getReaderAnalytics(
      authorId,
      startOfMonth,
    );

    return {
      authorId,
      overview: {
        totalBooks,
        publishedBooks,
        draftBooks: totalBooks - publishedBooks,
        totalApplications,
        approvedApplications,
        pendingApplications,
        rejectedApplications,
        applicationsThisMonth,
        totalReviews,
        averageRating,
        overallApprovalRate,
        rejectionRate,
        averageResponseTime,
      },
      performance: {
        booksWithReviews,
        averageRating,
        topPerformingBooks,
      },
      readerAnalytics,
      trends: {
        monthlyApplications: await this.getMonthlyApplications(
          authorId,
          startDate,
        ),
        monthlyReviews: await this.getMonthlyReviews(authorId, startDate),
        approvalRateOverTime: await this.getApprovalRateOverTime(
          authorId,
          startDate,
        ),
      },
      ratingDistribution: await this.getAuthorRatingDistribution(authorId),
    };
  }

  private async getAverageRating(bookId: string): Promise<number> {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('AVG(review.rating)', 'average')
      .where('application.bookId = :bookId', { bookId })
      .getRawOne();

    return result?.average
      ? parseFloat(parseFloat(result.average).toFixed(1))
      : 0;
  }

  private async getRatingDistribution(bookId: string) {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('review.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('application.bookId = :bookId', { bookId })
      .groupBy('review.rating')
      .orderBy('review.rating', 'ASC')
      .getRawMany();

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    result.forEach((row) => {
      distribution[row.rating] = parseInt(row.count);
    });

    return distribution;
  }

  private async getReviewTypes(bookId: string) {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('review.reviewType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('application.bookId = :bookId', { bookId })
      .groupBy('review.reviewType')
      .getRawMany();

    const types = { text: 0, link: 0 };
    result.forEach((row) => {
      types[row.type] = parseInt(row.count);
    });

    return types;
  }

  private async getAverageWordCount(bookId: string): Promise<number> {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('AVG(review.wordCount)', 'average')
      .where('application.bookId = :bookId', { bookId })
      .andWhere('review.wordCount IS NOT NULL')
      .getRawOne();

    return result?.average ? Math.round(parseFloat(result.average)) : 0;
  }

  private async getRecentReviews(bookId: string, limit: number = 5) {
    return this.reviewRepo.find({
      where: {
        application: { bookId },
      },
      relations: ['application', 'application.reader'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private async getBookApplicationsThisMonth(
    bookId: string,
    startOfMonth: Date,
  ): Promise<number> {
    return this.applicationRepo.count({
      where: {
        bookId,
        appliedAt: MoreThanOrEqual(startOfMonth),
      },
    });
  }

  private async getBookApprovedApplicationsThisMonth(
    bookId: string,
    startOfMonth: Date,
  ): Promise<number> {
    return this.applicationRepo.count({
      where: {
        bookId,
        status: ApplicationStatus.APPROVED,
        appliedAt: MoreThanOrEqual(startOfMonth),
      },
    });
  }

  private async getBookRejectedApplicationsThisMonth(
    bookId: string,
    startOfMonth: Date,
  ): Promise<number> {
    return this.applicationRepo.count({
      where: {
        bookId,
        status: ApplicationStatus.REJECTED,
        appliedAt: MoreThanOrEqual(startOfMonth),
      },
    });
  }

  private async getBookAverageResponseTime(bookId: string): Promise<number> {
    const applications = await this.applicationRepo
      .createQueryBuilder('application')
      .select('application.appliedAt', 'appliedAt')
      .addSelect('application.respondedAt', 'respondedAt')
      .where('application.bookId = :bookId', { bookId })
      .andWhere('application.respondedAt IS NOT NULL')
      .getMany();

    if (applications.length === 0) {
      return 0;
    }

    const totalHours = applications.reduce((sum, app) => {
      const appliedAt = new Date(app.appliedAt);
      const respondedAt = new Date(app.respondedAt!);
      const diffHours =
        (respondedAt.getTime() - appliedAt.getTime()) / (1000 * 60 * 60);
      return sum + diffHours;
    }, 0);

    return Math.round(totalHours / applications.length);
  }

  private async getBookAverageReviewTime(bookId: string): Promise<number> {
    const reviews = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('application.copyReceivedAt', 'copyReceivedAt')
      .addSelect('review.createdAt', 'reviewCreatedAt')
      .where('application.bookId = :bookId', { bookId })
      .andWhere('application.copyReceivedAt IS NOT NULL')
      .getRawMany();

    if (reviews.length === 0) {
      return 0;
    }

    const totalDays = reviews.reduce((sum, r) => {
      const receivedAt = new Date(r.copyReceivedAt);
      const reviewedAt = new Date(r.reviewCreatedAt);
      const diffDays =
        (reviewedAt.getTime() - receivedAt.getTime()) / (1000 * 60 * 60 * 24);
      return sum + diffDays;
    }, 0);

    return Math.round((totalDays / reviews.length) * 10) / 10;
  }

  private async getReviewSubmissionRate(bookId: string): Promise<number> {
    const [approvedCount, reviewCount] = await Promise.all([
      this.applicationRepo.count({
        where: { bookId, status: ApplicationStatus.APPROVED },
      }),
      this.reviewRepo.count({
        where: {
          application: { bookId },
        },
      }),
    ]);

    return approvedCount > 0
      ? Math.round((reviewCount / approvedCount) * 100)
      : 0;
  }

  private async getApplicationConversionRate(bookId: string): Promise<number> {
    const [totalCount, approvedCount] = await Promise.all([
      this.applicationRepo.count({ where: { bookId } }),
      this.applicationRepo.count({
        where: { bookId, status: ApplicationStatus.APPROVED },
      }),
    ]);

    return totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
  }

  private async getReviewCompletionRate(bookId: string): Promise<number> {
    const [approvedCount, completedCount] = await Promise.all([
      this.applicationRepo.count({
        where: { bookId, status: ApplicationStatus.APPROVED },
      }),
      this.applicationRepo.count({
        where: {
          bookId,
          status: ApplicationStatus.APPROVED,
          reviewSubmittedAt: Not(IsNull()),
        },
      }),
    ]);

    return approvedCount > 0
      ? Math.round((completedCount / approvedCount) * 100)
      : 0;
  }

  private async getReaderAnalytics(authorId: string, startOfMonth: Date) {
    const applications = await this.applicationRepo.find({
      where: { book: { authorId } },
      relations: ['reader', 'book'],
      select: {
        id: true,
        readerId: true,
        status: true,
        appliedAt: true,
        readingStatus: true,
        reviewSubmittedAt: true,
        reader: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          createdAt: true,
        },
      },
    });

    const uniqueReaderIds = new Set(applications.map((app) => app.readerId));
    const totalUniqueReaders = uniqueReaderIds.size;

    const allReaderFirstApplications = await this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .select('application.readerId', 'readerId')
      .addSelect('MIN(application.appliedAt)', 'firstAppliedAt')
      .where('book.authorId = :authorId', { authorId })
      .groupBy('application.readerId')
      .getRawMany();

    const newReadersThisMonth = allReaderFirstApplications.filter(
      (reader) => new Date(reader.firstAppliedAt) >= startOfMonth,
    ).length;

    const readerApplicationCounts = new Map<string, number>();
    applications.forEach((app) => {
      const count = readerApplicationCounts.get(app.readerId) || 0;
      readerApplicationCounts.set(app.readerId, count + 1);
    });
    const repeatReaders = Array.from(readerApplicationCounts.values()).filter(
      (count) => count > 1,
    ).length;

    const readingStatusBreakdown = {
      notStarted: applications.filter(
        (app) => app.readingStatus === 'not_started',
      ).length,
      currentlyReading: applications.filter(
        (app) => app.readingStatus === 'currently_reading',
      ).length,
      forReview: applications.filter(
        (app) => app.readingStatus === 'for_review',
      ).length,
      reviewed: applications.filter((app) => app.readingStatus === 'reviewed')
        .length,
    };

    const readersWithReviews = new Set(
      applications
        .filter((app) => app.reviewSubmittedAt !== null)
        .map((app) => app.readerId),
    ).size;

    const topReaders = Array.from(readerApplicationCounts.entries())
      .map(([readerId, count]) => {
        const reader = applications.find(
          (app) => app.readerId === readerId,
        )?.reader;
        return {
          readerId,
          readerName: reader
            ? `${reader.firstName} ${reader.lastName}`
            : 'Unknown',
          username: reader?.username || null,
          avatarUrl: reader?.avatarUrl || null,
          totalApplications: count,
          approvedApplications: applications.filter(
            (app) => app.readerId === readerId && app.status === 'approved',
          ).length,
          completedReviews: applications.filter(
            (app) =>
              app.readerId === readerId && app.reviewSubmittedAt !== null,
          ).length,
        };
      })
      .sort((a, b) => b.totalApplications - a.totalApplications)
      .slice(0, 10);

    const averageApplicationsPerReader =
      totalUniqueReaders > 0
        ? parseFloat((applications.length / totalUniqueReaders).toFixed(2))
        : 0;

    const approvedReaders = new Set(
      applications
        .filter((app) => app.status === 'approved')
        .map((app) => app.readerId),
    ).size;
    const engagementRate =
      approvedReaders > 0
        ? Math.round((readersWithReviews / approvedReaders) * 100)
        : 0;

    const readerIds = Array.from(uniqueReaderIds);
    const readers =
      readerIds.length > 0
        ? await this.userRepo.find({
            where: { id: In(readerIds) },
            select: {
              id: true,
              birthDate: true,
            },
          })
        : [];

    const addresses =
      readerIds.length > 0
        ? await this.userAddressRepo.find({
            where: {
              userId: In(readerIds),
              isPrimary: true,
            },
            select: {
              userId: true,
              country: true,
            },
          })
        : [];

    const genrePreferences =
      readerIds.length > 0
        ? await this.userGenrePrefRepo.find({
            where: {
              user: { id: In(readerIds) },
            },
            relations: ['genre', 'user'],
            select: {
              id: true,
              user: {
                id: true,
              },
              genre: {
                id: true,
                name: true,
              },
            },
          })
        : [];

    const bookIds = [...new Set(applications.map((app) => app.bookId))];
    const bookGenres =
      bookIds.length > 0
        ? await this.bookGenreRepo.find({
            where: {
              bookId: In(bookIds),
            },
            relations: ['genre'],
            select: {
              bookId: true,
              genre: {
                id: true,
                name: true,
              },
            },
          })
        : [];

    const ageData = this.calculateAgeDemographics(readers);

    const countryBreakdown = this.calculateCountryBreakdown(
      addresses,
      totalUniqueReaders,
    );

    const genrePreferencesBreakdown = this.calculateGenreBreakdown(
      genrePreferences,
      totalUniqueReaders,
    );

    const appliedBookGenresBreakdown = this.calculateAppliedBookGenresBreakdown(
      bookGenres,
      applications,
      totalUniqueReaders,
    );

    return {
      totalUniqueReaders,
      newReadersThisMonth,
      repeatReaders,
      averageApplicationsPerReader,
      engagementRate,
      readersWithReviews,
      readingStatusBreakdown,
      topReaders,
      demographics: {
        age: ageData,
        countries: countryBreakdown,
        genrePreferences: genrePreferencesBreakdown,
        appliedBookGenres: appliedBookGenresBreakdown,
      },
    };
  }

  private calculateAgeDemographics(readers: User[]) {
    const now = new Date();
    const ages: number[] = [];

    readers.forEach((reader) => {
      if (reader.birthDate) {
        const birthDate = new Date(reader.birthDate);
        const age = now.getFullYear() - birthDate.getFullYear();
        const monthDiff = now.getMonth() - birthDate.getMonth();
        const adjustedAge =
          monthDiff < 0 ||
          (monthDiff === 0 && now.getDate() < birthDate.getDate())
            ? age - 1
            : age;
        if (adjustedAge > 0 && adjustedAge < 120) {
          ages.push(adjustedAge);
        }
      }
    });

    if (ages.length === 0) {
      return {
        averageAge: 0,
        ageRanges: [],
      };
    }

    const averageAge = Math.round(
      ages.reduce((sum, age) => sum + age, 0) / ages.length,
    );

    const ranges = [
      { label: '13-17', min: 13, max: 17 },
      { label: '18-24', min: 18, max: 24 },
      { label: '25-34', min: 25, max: 34 },
      { label: '35-44', min: 35, max: 44 },
      { label: '45-54', min: 45, max: 54 },
      { label: '55-64', min: 55, max: 64 },
      { label: '65+', min: 65, max: 200 },
    ];

    const ageRanges = ranges
      .map((range) => {
        const count = ages.filter(
          (age) => age >= range.min && age <= range.max,
        ).length;
        const percentage =
          ages.length > 0 ? Math.round((count / ages.length) * 100) : 0;
        return {
          range: range.label,
          count,
          percentage,
        };
      })
      .filter((range) => range.count > 0);

    return {
      averageAge,
      totalWithAge: ages.length,
      ageRanges,
    };
  }

  private calculateCountryBreakdown(
    addresses: UserAddress[],
    totalReaders: number,
  ) {
    const countryCounts = new Map<string, number>();

    addresses.forEach((addr) => {
      const country = addr.country || 'Unknown';
      const count = countryCounts.get(country) || 0;
      countryCounts.set(country, count + 1);
    });

    const countries = Array.from(countryCounts.entries())
      .map(([country, count]) => ({
        country,
        count,
        percentage:
          totalReaders > 0 ? Math.round((count / totalReaders) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalWithCountry: addresses.length,
      countries,
    };
  }

  private calculateGenreBreakdown(
    preferences: UserGenrePreference[],
    totalReaders: number,
  ) {
    const genreCounts = new Map<string, number>();
    const readerGenreSet = new Map<string, Set<string>>();

    preferences.forEach((pref) => {
      if (pref.genre && pref.user) {
        const genreName = pref.genre.name;
        const userId = typeof pref.user === 'object' ? pref.user.id : pref.user;

        if (!readerGenreSet.has(genreName)) {
          readerGenreSet.set(genreName, new Set());
        }
        readerGenreSet.get(genreName)!.add(userId);
      }
    });

    readerGenreSet.forEach((readers, genre) => {
      genreCounts.set(genre, readers.size);
    });

    const genres = Array.from(genreCounts.entries())
      .map(([genre, count]) => ({
        genre,
        count,
        percentage:
          totalReaders > 0 ? Math.round((count / totalReaders) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalWithPreferences: new Set(
        preferences.map((p) =>
          typeof p.user === 'object' ? p.user.id : p.user,
        ),
      ).size,
      genres,
    };
  }

  private calculateAppliedBookGenresBreakdown(
    bookGenres: BookGenre[],
    applications: Application[],
    totalReaders: number,
  ) {
    const genreCounts = new Map<string, number>();
    const readerGenreSet = new Map<string, Set<string>>();

    const bookGenreMap = new Map<string, string[]>();
    bookGenres.forEach((bg) => {
      if (bg.genre) {
        const genres = bookGenreMap.get(bg.bookId) || [];
        genres.push(bg.genre.name);
        bookGenreMap.set(bg.bookId, genres);
      }
    });

    applications.forEach((app) => {
      const genres = bookGenreMap.get(app.bookId) || [];
      genres.forEach((genreName) => {
        if (!readerGenreSet.has(genreName)) {
          readerGenreSet.set(genreName, new Set());
        }
        readerGenreSet.get(genreName)!.add(app.readerId);
      });
    });

    readerGenreSet.forEach((readers, genre) => {
      genreCounts.set(genre, readers.size);
    });

    const genres = Array.from(genreCounts.entries())
      .map(([genre, count]) => ({
        genre,
        count,
        percentage:
          totalReaders > 0 ? Math.round((count / totalReaders) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      genres,
    };
  }

  private async getAuthorAverageRating(
    authorId: string,
    startDate: Date | null = null,
  ): Promise<number> {
    const query = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('AVG(review.rating)', 'average')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true });

    if (startDate) {
      query.andWhere('review.createdAt >= :startDate', { startDate });
    }

    const result = await query.getRawOne();

    return result?.average
      ? parseFloat(parseFloat(result.average).toFixed(1))
      : 0;
  }

  private async getBooksWithReviews(authorId: string) {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('COUNT(DISTINCT application.bookId)', 'count')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .getRawOne();

    return parseInt(result?.count || '0');
  }

  private async getTopPerformingBooks(authorId: string, limit: number = 5) {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('book.id', 'bookId')
      .addSelect('book.title', 'title')
      .addSelect('AVG(review.rating)', 'averageRating')
      .addSelect('COUNT(review.id)', 'reviewCount')
      .where('book.authorId = :authorId', { authorId })
      .groupBy('book.id')
      .addGroupBy('book.title')
      .orderBy('AVG(review.rating)', 'DESC')
      .addOrderBy('COUNT(review.id)', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map((row) => ({
      bookId: row.bookId,
      title: row.title,
      averageRating: parseFloat(row.averageRating || '0'),
      reviewCount: parseInt(row.reviewCount || '0'),
    }));
  }

  private async getMonthlyApplications(
    authorId: string,
    startDate: Date | null = null,
  ) {
    const query = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .select("DATE_TRUNC('month', application.appliedAt)", 'month')
      .addSelect('COUNT(*)', 'count')
      .where('book.authorId = :authorId', { authorId });

    if (startDate) {
      query.andWhere('application.appliedAt >= :startDate', { startDate });
    } else {
      query.andWhere('application.appliedAt >= :sixMonthsAgo', {
        sixMonthsAgo: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
      });
    }

    const result = await query
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    return result.map((row) => ({
      month: row.month,
      count: parseInt(row.count),
    }));
  }

  private async getMonthlyReviews(
    authorId: string,
    startDate: Date | null = null,
  ) {
    const query = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select("DATE_TRUNC('month', review.createdAt)", 'month')
      .addSelect('COUNT(*)', 'count')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true });

    if (startDate) {
      query.andWhere('review.createdAt >= :startDate', { startDate });
    } else {
      query.andWhere('review.createdAt >= :sixMonthsAgo', {
        sixMonthsAgo: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
      });
    }

    const result = await query
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    return result.map((row) => ({
      month: row.month,
      count: parseInt(row.count),
    }));
  }

  private async getAuthorAverageResponseTime(
    authorId: string,
  ): Promise<number> {
    const applications = await this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .select('application.appliedAt', 'appliedAt')
      .addSelect('application.respondedAt', 'respondedAt')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('application.respondedAt IS NOT NULL')
      .getMany();

    if (applications.length === 0) {
      return 0;
    }

    const totalDays = applications.reduce((sum, app) => {
      if (app.respondedAt && app.appliedAt) {
        const diffTime = app.respondedAt.getTime() - app.appliedAt.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return sum + diffDays;
      }
      return sum;
    }, 0);

    return Math.round(totalDays / applications.length);
  }

  private getDateRange(dateRange?: string): {
    startDate: Date | null;
    endDate: Date | null;
  } {
    const now = new Date();
    let startDate: Date | null = null;
    const endDate: Date | null = null;

    if (dateRange) {
      switch (dateRange.toLowerCase()) {
        case '7d':
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
        case '30days':
        case '1m':
        case '1month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
        case '90days':
        case '3m':
        case '3months':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '6m':
        case '6months':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
        case '1year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
        case 'alltime':
          startDate = null;
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    return { startDate, endDate };
  }

  async getBookPerformanceComparison(authorId: string) {
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
          totalApplications: parseInt(app.totalApplications || '0'),
          approvedApplications: parseInt(app.approvedApplications || '0'),
        },
      ]),
    );

    const reviewMap = new Map(
      reviews.map((review) => [
        review.bookId,
        {
          averageRating: parseFloat(review.averageRating || '0'),
          reviewCount: parseInt(review.reviewCount || '0'),
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

      const approvalRate =
        appStats.totalApplications > 0
          ? Math.round(
              (appStats.approvedApplications / appStats.totalApplications) *
                100,
            )
          : 0;

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
        approvalRate,
      };
    });
  }

  private async getApprovalRateOverTime(
    authorId: string,
    startDate: Date | null = null,
  ) {
    const query = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .select("DATE_TRUNC('month', application.appliedAt)", 'month')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        'SUM(CASE WHEN application.status = :approved THEN 1 ELSE 0 END)',
        'approved',
      )
      .where('book.authorId = :authorId', { authorId })
      .setParameter('approved', ApplicationStatus.APPROVED);

    if (startDate) {
      query.andWhere('application.appliedAt >= :startDate', { startDate });
    } else {
      query.andWhere('application.appliedAt >= :sixMonthsAgo', {
        sixMonthsAgo: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
      });
    }

    const result = await query
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    return result.map((row) => {
      const total = parseInt(row.total || '0');
      const approved = parseInt(row.approved || '0');
      const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

      return {
        month: row.month,
        total,
        approved,
        approvalRate,
      };
    });
  }

  private async getAuthorRatingDistribution(authorId: string) {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('review.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .groupBy('review.rating')
      .orderBy('review.rating', 'ASC')
      .getRawMany();

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    result.forEach((row) => {
      distribution[row.rating] = parseInt(row.count);
    });

    return distribution;
  }
}
