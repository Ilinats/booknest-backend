import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { ApplicationStatus, ReadingStatus } from '../../applications/enums';
import { UserType } from '../enums';

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

@Injectable()
export class UsersReaderStatsHelper {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  async getStats(readerId: string): Promise<Record<string, unknown>> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalApplications,
      approvedApplications,
      pendingApplications,
      completedReads,
      completedReadsThisMonth,
      completedReadsThisYear,
      totalReviews,
      averageRating,
      totalWordCount,
      pagesRead,
      genresBreakdown,
      averageReadingTime,
      reviewCompletionRate,
    ] = await Promise.all([
      this.applicationRepo.count({ where: { readerId } }),
      this.applicationRepo.count({
        where: { readerId, status: ApplicationStatus.APPROVED },
      }),
      this.applicationRepo.count({
        where: { readerId, status: ApplicationStatus.PENDING },
      }),
      this.applicationRepo.count({
        where: { readerId, readingStatus: ReadingStatus.REVIEWED },
      }),
      this.applicationRepo.count({
        where: {
          readerId,
          readingStatus: ReadingStatus.REVIEWED,
          readingCompletedAt: MoreThanOrEqual(startOfMonth),
        },
      }),
      this.applicationRepo.count({
        where: {
          readerId,
          readingStatus: ReadingStatus.REVIEWED,
          readingCompletedAt: MoreThanOrEqual(startOfYear),
        },
      }),
      this.reviewRepo.count({ where: { application: { readerId } } }),
      this.getAverageRating(readerId),
      this.getTotalWordCount(readerId),
      this.getPagesRead(readerId),
      this.getGenresBreakdown(readerId),
      this.getAverageReadingTime(readerId),
      this.getReviewCompletionRate(readerId),
    ]);

    return {
      totalApplications,
      approvedApplications,
      pendingApplications,
      successRate: percent(approvedApplications, totalApplications),
      completedReads,
      completedReadsThisMonth,
      completedReadsThisYear,
      totalReviews,
      averageRating,
      totalWordCount,
      pagesRead,
      genresBreakdown,
      averageReadingTime,
      reviewCompletionRate,
      userType: UserType.READER,
    };
  }

  private async getAverageRating(readerId: string): Promise<number> {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('AVG(review.rating)', 'average')
      .where('application.readerId = :readerId', { readerId })
      .getRawOne();

    return result?.average
      ? parseFloat(parseFloat(result.average).toFixed(1))
      : 0;
  }

  private async getTotalWordCount(readerId: string): Promise<number> {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('SUM(review.wordCount)', 'total')
      .where('application.readerId = :readerId', { readerId })
      .andWhere('review.wordCount IS NOT NULL')
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  private async getPagesRead(readerId: string): Promise<number> {
    const result = await this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .select('SUM(book.pageCount)', 'total')
      .where('application.readerId = :readerId', { readerId })
      .andWhere('application.readingStatus = :status', {
        status: ReadingStatus.REVIEWED,
      })
      .andWhere('book.pageCount IS NOT NULL')
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  private async getGenresBreakdown(
    readerId: string,
  ): Promise<Array<{ genreId: number; genreName: string; count: number }>> {
    const result = await this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .leftJoin('book.bookGenres', 'bookGenre')
      .leftJoin('bookGenre.genre', 'genre')
      .select('genre.id', 'genreId')
      .addSelect('genre.name', 'genreName')
      .addSelect('COUNT(DISTINCT application.bookId)', 'count')
      .where('application.readerId = :readerId', { readerId })
      .andWhere('application.readingStatus = :status', {
        status: ReadingStatus.REVIEWED,
      })
      .andWhere('genre.id IS NOT NULL')
      .groupBy('genre.id')
      .addGroupBy('genre.name')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map((row) => ({
      genreId: parseInt(row.genreId, 10),
      genreName: row.genreName,
      count: parseInt(row.count, 10),
    }));
  }

  private async getAverageReadingTime(readerId: string): Promise<number> {
    const result = await this.applicationRepo
      .createQueryBuilder('application')
      .select(
        `AVG(EXTRACT(EPOCH FROM (application.readingCompletedAt - application.readingStartedAt)) / 86400)`,
        'averageDays',
      )
      .where('application.readerId = :readerId', { readerId })
      .andWhere('application.readingStatus = :status', {
        status: ReadingStatus.REVIEWED,
      })
      .andWhere('application.readingStartedAt IS NOT NULL')
      .andWhere('application.readingCompletedAt IS NOT NULL')
      .getRawOne();

    return result?.averageDays
      ? Math.round(parseFloat(result.averageDays) * 10) / 10
      : 0;
  }

  private async getReviewCompletionRate(readerId: string): Promise<number> {
    const [completedReads, reviews] = await Promise.all([
      this.applicationRepo.count({
        where: {
          readerId,
          readingStatus: ReadingStatus.REVIEWED,
        },
      }),
      this.reviewRepo.count({
        where: { application: { readerId } },
      }),
    ]);

    return percent(reviews, completedReads);
  }
}
