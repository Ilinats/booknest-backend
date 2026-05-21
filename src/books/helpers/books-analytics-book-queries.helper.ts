import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { UserAddress } from '../../user-address/entity/user-address.entity';
import { UserGenrePreference } from '../../user-genre-preferences/entity/user-genre-preference.entity';
import { ApplicationStatus } from '../../applications/enums';
import { ReviewType } from '../../reviews/enums';
import {
  calculateAgeDemographics,
  calculateCountryBreakdown,
  calculateGenreBreakdown,
} from './books-analytics-demographics.helper';

export const APPROVED_READER_STATUSES = [ApplicationStatus.APPROVED];

export type BookApplicationCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  thisMonth: {
    total: number;
    approved: number;
    rejected: number;
  };
};

export type BookReviewStats = {
  totalReviews: number;
  averageRating: number;
  positiveFeedback: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  reviewTypes: { text: number; link: number };
  averageWordCount: number;
};

@Injectable()
export class BooksAnalyticsBookQueriesHelper {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepo: Repository<UserAddress>,
    @InjectRepository(UserGenrePreference)
    private readonly userGenrePrefRepo: Repository<UserGenrePreference>,
  ) {}

  async getApplicationCounts(
    bookId: string,
    startOfMonth: Date,
  ): Promise<BookApplicationCounts> {
    const row = await this.applicationRepo
      .createQueryBuilder('application')
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
        `COUNT(*) FILTER (WHERE application.status = :withdrawn)`,
        'withdrawn',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE application.appliedAt >= :startOfMonth)`,
        'thisMonthTotal',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE application.appliedAt >= :startOfMonth AND application.status = :approved)`,
        'thisMonthApproved',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE application.appliedAt >= :startOfMonth AND application.status = :rejected)`,
        'thisMonthRejected',
      )
      .where('application.bookId = :bookId', { bookId })
      .setParameters({
        approved: ApplicationStatus.APPROVED,
        pending: ApplicationStatus.PENDING,
        rejected: ApplicationStatus.REJECTED,
        withdrawn: ApplicationStatus.WITHDRAWN,
        startOfMonth,
      })
      .getRawOne();

    return {
      total: parseCount(row?.total),
      pending: parseCount(row?.pending),
      approved: parseCount(row?.approved),
      rejected: parseCount(row?.rejected),
      withdrawn: parseCount(row?.withdrawn),
      thisMonth: {
        total: parseCount(row?.thisMonthTotal),
        approved: parseCount(row?.thisMonthApproved),
        rejected: parseCount(row?.thisMonthRejected),
      },
    };
  }

  async getReviewStats(bookId: string): Promise<BookReviewStats> {
    const [summary, distributionRows] = await Promise.all([
      this.reviewRepo
        .createQueryBuilder('review')
        .leftJoin('review.application', 'application')
        .select('COUNT(*)', 'total')
        .addSelect('AVG(review.rating)', 'average')
        .addSelect(
          'AVG(review.wordCount) FILTER (WHERE review.wordCount IS NOT NULL)',
          'avgWordCount',
        )
        .addSelect(
          'COUNT(*) FILTER (WHERE review.rating >= 4)',
          'positiveCount',
        )
        .addSelect(
          `COUNT(*) FILTER (WHERE review.reviewType = :textType)`,
          'textCount',
        )
        .addSelect(
          `COUNT(*) FILTER (WHERE review.reviewType = :linkType)`,
          'linkCount',
        )
        .where('application.bookId = :bookId', { bookId })
        .setParameters({
          textType: ReviewType.TEXT,
          linkType: ReviewType.LINK,
        })
        .getRawOne(),
      this.reviewRepo
        .createQueryBuilder('review')
        .leftJoin('review.application', 'application')
        .select('review.rating', 'rating')
        .addSelect('COUNT(*)', 'count')
        .where('application.bookId = :bookId', { bookId })
        .groupBy('review.rating')
        .getRawMany(),
    ]);

    const totalReviews = parseCount(summary?.total);
    const positiveCount = parseCount(summary?.positiveCount);

    return {
      totalReviews,
      averageRating: summary?.average
        ? parseFloat(parseFloat(summary.average).toFixed(1))
        : 0,
      positiveFeedback:
        totalReviews > 0
          ? Math.round((positiveCount / totalReviews) * 100)
          : 0,
      ratingDistribution: buildRatingDistribution(distributionRows),
      reviewTypes: {
        text: parseCount(summary?.textCount),
        link: parseCount(summary?.linkCount),
      },
      averageWordCount: summary?.avgWordCount
        ? Math.round(parseFloat(summary.avgWordCount))
        : 0,
    };
  }

  async getRecentReviews(bookId: string, limit: number = 5) {
    return this.reviewRepo.find({
      where: {
        application: { bookId },
      },
      relations: ['application', 'application.reader'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getBookAverageResponseTime(bookId: string): Promise<number> {
    const result = await this.applicationRepo
      .createQueryBuilder('application')
      .select(
        `AVG(EXTRACT(EPOCH FROM (application.respondedAt - application.appliedAt)) / 3600)`,
        'averageHours',
      )
      .where('application.bookId = :bookId', { bookId })
      .andWhere('application.respondedAt IS NOT NULL')
      .getRawOne();

    return result?.averageHours
      ? Math.round(parseFloat(result.averageHours))
      : 0;
  }

  async getBookAverageReviewTime(bookId: string): Promise<number> {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select(
        `AVG(EXTRACT(EPOCH FROM (review.createdAt - application.copyReceivedAt)) / 86400)`,
        'averageDays',
      )
      .where('application.bookId = :bookId', { bookId })
      .andWhere('application.copyReceivedAt IS NOT NULL')
      .getRawOne();

    return result?.averageDays
      ? Math.round(parseFloat(result.averageDays) * 10) / 10
      : 0;
  }

  async getBookReaderInsights(bookId: string) {
    const applications = await this.applicationRepo.find({
      where: { bookId },
      relations: ['reader'],
      select: {
        id: true,
        readerId: true,
        reader: {
          id: true,
          birthDate: true,
        },
      },
    });

    const uniqueReaderIds = [
      ...new Set(applications.map((app) => app.readerId)),
    ];

    if (uniqueReaderIds.length === 0) {
      return {
        totalApplicants: 0,
        demographics: {
          age: calculateAgeDemographics([]),
          countries: calculateCountryBreakdown([], 0),
          genrePreferences: calculateGenreBreakdown([], 0),
        },
      };
    }

    const readers = [
      ...new Map(
        applications
          .filter((app) => app.reader)
          .map((app) => [app.readerId, app.reader!]),
      ).values(),
    ];

    const [addresses, genrePreferences] = await Promise.all([
      this.userAddressRepo.find({
        where: {
          userId: In(uniqueReaderIds),
          isPrimary: true,
        },
        select: {
          userId: true,
          country: true,
        },
      }),
      this.userGenrePrefRepo.find({
        where: {
          user: { id: In(uniqueReaderIds) },
        },
        relations: ['genre'],
        select: {
          user: { id: true },
          genre: { id: true, name: true },
        },
      }),
    ]);

    return {
      totalApplicants: uniqueReaderIds.length,
      demographics: {
        age: calculateAgeDemographics(readers),
        countries: calculateCountryBreakdown(
          addresses,
          uniqueReaderIds.length,
        ),
        genrePreferences: calculateGenreBreakdown(
          genrePreferences,
          uniqueReaderIds.length,
        ),
      },
    };
  }
}

function parseCount(value: string | number | null | undefined): number {
  return parseInt(String(value ?? '0'), 10) || 0;
}

function buildRatingDistribution(
  rows: Array<{ rating: string | number; count: string | number }>,
): Record<1 | 2 | 3 | 4 | 5, number> {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  rows.forEach((row) => {
    const rating = Math.round(Number(row.rating)) as 1 | 2 | 3 | 4 | 5;
    if (rating >= 1 && rating <= 5) {
      distribution[rating] = parseCount(row.count);
    }
  });

  return distribution;
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export { percent };
