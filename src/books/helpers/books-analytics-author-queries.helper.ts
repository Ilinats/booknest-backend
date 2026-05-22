import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { UserAddress } from '../../user-address/entity/user-address.entity';
import { UserGenrePreference } from '../../user-genre-preferences/entity/user-genre-preference.entity';
import { Book } from '../entity/book.entity';
import { BookGenre } from '../entity/book-genre.entity';
import { BookStatus } from '../enums';
import {
  ApplicationStatus,
  ReadingStatus,
} from '../../applications/enums';
import {
  calculateAgeDemographics,
  calculateAppliedBookGenresBreakdown,
  calculateCountryBreakdown,
  calculateGenreBreakdown,
} from './books-analytics-demographics.helper';

export type AuthorBookStatusCounts = {
  total: number;
  published: number;
  draft: number;
  inProgress: number;
  completed: number;
};

export type AuthorApplicationCounts = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  thisMonth: number;
};

@Injectable()
export class BooksAnalyticsAuthorQueriesHelper {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepo: Repository<UserAddress>,
    @InjectRepository(UserGenrePreference)
    private readonly userGenrePrefRepo: Repository<UserGenrePreference>,
    @InjectRepository(BookGenre)
    private readonly bookGenreRepo: Repository<BookGenre>,
  ) {}

  async getBookStatusCounts(authorId: string): Promise<AuthorBookStatusCounts> {
    const rows = await this.bookRepo
      .createQueryBuilder('book')
      .select('book.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('book.authorId = :authorId', { authorId })
      .groupBy('book.status')
      .getRawMany<{ status: BookStatus; count: string }>();

    const counts: AuthorBookStatusCounts = {
      total: 0,
      published: 0,
      draft: 0,
      inProgress: 0,
      completed: 0,
    };

    rows.forEach((row) => {
      const count = parseCount(row.count);
      counts.total += count;
      switch (row.status) {
        case BookStatus.ACTIVE:
          counts.published = count;
          break;
        case BookStatus.DRAFT:
          counts.draft = count;
          break;
        case BookStatus.IN_PROGRESS:
          counts.inProgress = count;
          break;
        case BookStatus.COMPLETED:
          counts.completed = count;
          break;
      }
    });

    return counts;
  }

  async getApplicationOverview(
    authorId: string,
    startDate: Date | null,
    startOfMonth: Date,
  ): Promise<AuthorApplicationCounts> {
    const query = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE application.status = :approved)`,
        'approved',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE application.status = :pending)`,
        'pending',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE application.status = :rejected)`,
        'rejected',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE application.appliedAt >= :startOfMonth)`,
        'thisMonth',
      )
      .where('book.authorId = :authorId', { authorId })
      .setParameters({
        approved: ApplicationStatus.APPROVED,
        pending: ApplicationStatus.PENDING,
        rejected: ApplicationStatus.REJECTED,
        startOfMonth,
      });

    if (startDate) {
      query.andWhere('application.appliedAt >= :startDate', { startDate });
    }

    const row = await query.getRawOne();

    return {
      total: parseCount(row?.total),
      approved: parseCount(row?.approved),
      pending: parseCount(row?.pending),
      rejected: parseCount(row?.rejected),
      thisMonth: parseCount(row?.thisMonth),
    };
  }

  async getReaderAnalytics(authorId: string, startOfMonth: Date) {
    const applications = await this.applicationRepo.find({
      where: { book: { authorId } },
      relations: ['reader', 'book'],
      select: {
        id: true,
        bookId: true,
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
          birthDate: true,
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

    const readerStats = new Map<
      string,
      {
        total: number;
        approved: number;
        completedReviews: number;
        reader?: Application['reader'];
      }
    >();

    const readingStatusBreakdown = {
      notStarted: 0,
      currentlyReading: 0,
      forReview: 0,
      reviewed: 0,
    };

    const readersWithReviews = new Set<string>();
    const approvedReaders = new Set<string>();

    for (const app of applications) {
      const stats = readerStats.get(app.readerId) ?? {
        total: 0,
        approved: 0,
        completedReviews: 0,
        reader: app.reader,
      };
      stats.total += 1;
      if (!stats.reader && app.reader) {
        stats.reader = app.reader;
      }
      if (app.status === ApplicationStatus.APPROVED) {
        stats.approved += 1;
        approvedReaders.add(app.readerId);
      }
      if (app.reviewSubmittedAt !== null) {
        stats.completedReviews += 1;
        readersWithReviews.add(app.readerId);
      }
      readerStats.set(app.readerId, stats);

      switch (app.readingStatus) {
        case ReadingStatus.NOT_STARTED:
          readingStatusBreakdown.notStarted += 1;
          break;
        case ReadingStatus.CURRENTLY_READING:
          readingStatusBreakdown.currentlyReading += 1;
          break;
        case ReadingStatus.FOR_REVIEW:
          readingStatusBreakdown.forReview += 1;
          break;
        case ReadingStatus.REVIEWED:
          readingStatusBreakdown.reviewed += 1;
          break;
      }
    }

    const repeatReaders = Array.from(readerStats.values()).filter(
      (stats) => stats.total > 1,
    ).length;

    const topReaders = Array.from(readerStats.entries())
      .map(([readerId, stats]) => ({
        readerId,
        readerName: stats.reader
          ? `${stats.reader.firstName} ${stats.reader.lastName}`
          : 'Unknown',
        username: stats.reader?.username || null,
        avatarUrl: stats.reader?.avatarUrl || null,
        totalApplications: stats.total,
        approvedApplications: stats.approved,
        completedReviews: stats.completedReviews,
      }))
      .sort((a, b) => b.totalApplications - a.totalApplications)
      .slice(0, 10);

    const averageApplicationsPerReader =
      totalUniqueReaders > 0
        ? parseFloat((applications.length / totalUniqueReaders).toFixed(2))
        : 0;

    const engagementRate =
      approvedReaders.size > 0
        ? Math.round((readersWithReviews.size / approvedReaders.size) * 100)
        : 0;

    const readerIds = Array.from(uniqueReaderIds);
    const readers = [
      ...new Map(
        applications
          .filter((app) => app.reader)
          .map((app) => [app.readerId, app.reader!]),
      ).values(),
    ];

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

    const ageData = calculateAgeDemographics(readers);

    const countryBreakdown = calculateCountryBreakdown(
      addresses,
      totalUniqueReaders,
    );

    const genrePreferencesBreakdown = calculateGenreBreakdown(
      genrePreferences,
      totalUniqueReaders,
    );

    const appliedBookGenresBreakdown = calculateAppliedBookGenresBreakdown(
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
      readersWithReviews: readersWithReviews.size,
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

  async getAuthorAverageRating(
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

  async getBooksWithReviews(authorId: string) {
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

  async getTopPerformingBooks(authorId: string, limit: number = 5) {
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

  async getMonthlyApplications(
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

  async getMonthlyReviews(
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

  async getAuthorAverageResponseTime(authorId: string): Promise<number> {
    const result = await this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .select(
        `AVG(EXTRACT(EPOCH FROM (application.respondedAt - application.appliedAt)) / 86400)`,
        'averageDays',
      )
      .where('book.authorId = :authorId', { authorId })
      .andWhere('application.respondedAt IS NOT NULL')
      .getRawOne();

    return result?.averageDays
      ? Math.round(parseFloat(result.averageDays))
      : 0;
  }

  getDateRange(dateRange?: string): {
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

  async getApprovalRateOverTime(
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

  async getAuthorRatingDistribution(authorId: string) {
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

function parseCount(value: string | number | null | undefined): number {
  return parseInt(String(value ?? '0'), 10) || 0;
}
