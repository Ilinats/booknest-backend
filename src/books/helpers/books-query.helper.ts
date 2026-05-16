import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, In, MoreThan } from 'typeorm';
import { PaginateQuery, paginate, FilterOperator } from 'nestjs-paginate';
import { Book } from '../entity/book.entity';
import { BookGenre } from '../entity/book-genre.entity';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { UserGenrePreference } from '../../user-genre-preferences/entity/user-genre-preference.entity';
import {
  BookStatus,
  ApplicationStatusFilter,
  DeadlineFilter,
  BookSortBy,
} from '../enums';
import { UserType } from '../../users/enums';

@Injectable()
export class BooksQueryHelper {
  private getPaginateConfig() {
    return {
      sortableColumns: [
        'publishedAt',
        'createdAt',
        'title',
        'status',
        'author.firstName',
        'series.name',
      ] as any[],
      searchableColumns: [
        'title',
        'shortDescription',
        'fullDescription',
        'author.firstName',
        'author.lastName',
        'series.name',
      ] as any[],
      filterableColumns: {
        status: [FilterOperator.EQ, FilterOperator.IN],
        ageRating: [FilterOperator.EQ],
        distributionType: [FilterOperator.EQ],
        authorId: [FilterOperator.EQ],
        seriesId: [FilterOperator.EQ],
        title: [FilterOperator.ILIKE],
        publishedAt: [
          FilterOperator.GTE,
          FilterOperator.LTE,
          FilterOperator.BTW,
        ],
        createdAt: [FilterOperator.GTE, FilterOperator.LTE, FilterOperator.BTW],
        'author.firstName': [FilterOperator.ILIKE],
        'author.lastName': [FilterOperator.ILIKE],
        'series.name': [FilterOperator.ILIKE],
        availableCopies: [FilterOperator.GT],
        applicationDeadline: [FilterOperator.GT, FilterOperator.LTE],
      },
      defaultSortBy: [['publishedAt', 'DESC']] as any,
      defaultLimit: 20,
      maxLimit: 100,
    };
  }

  private readonly BOOK_RELATIONS = [
    'author',
    'series',
    'bookGenres',
    'bookGenres.genre',
  ];

  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(BookGenre)
    private readonly bookGenreRepo: Repository<BookGenre>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(UserGenrePreference)
    private readonly userGenrePrefRepo: Repository<UserGenrePreference>,
  ) {}

  async browse(query: PaginateQuery, userId?: string, userType?: UserType) {
    if (this.hasComplexFilters(query)) {
      return this.browseWithComplexFilters(query, userId, userType);
    }

    const where = this.buildSimpleWhere(query);
    const result = await paginate(query, this.bookRepo, {
      ...this.getPaginateConfig(),
      where,
      relations: this.BOOK_RELATIONS,
    });

    return {
      ...result,
      data: this.sanitizeBooks(result.data, userId, userType),
    };
  }

  async featured(userId?: string, userType?: UserType): Promise<Book[]> {
    const qb = this.createQueryBuilder()
      .where('book.status = :status', { status: BookStatus.ACTIVE })
      .andWhere('book.availableCopies > 0')
      .andWhere('book.applicationDeadline > :now', { now: new Date() })
      .orderBy('book.publishedAt', 'DESC', 'NULLS LAST')
      .take(10);

    const books = await qb.getMany();
    return this.sanitizeBooks(books, userId, userType);
  }

  async recommendedForUser(
    userId: string,
    query: PaginateQuery,
    userType?: UserType,
  ) {
    if (!userId) {
      return this.fallbackToFeatured(query, userId, userType);
    }

    const userPreferences = await this.userGenrePrefRepo.find({
      where: { user: { id: userId } },
      relations: ['genre'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    if (userPreferences.length === 0) {
      return this.fallbackToFeatured(query, userId, userType);
    }

    const genreIds = userPreferences.map((p) => p.genre.id);
    const qb = this.createQueryBuilder()
      .innerJoin('book.bookGenres', 'bg')
      .where('book.status = :status', { status: BookStatus.ACTIVE })
      .andWhere('bg.genreId IN (:...genreIds)', { genreIds })
      .andWhere('book.availableCopies > 0')
      .andWhere('book.applicationDeadline > :now', { now: new Date() })
      .groupBy('book.id')
      .addGroupBy('author.id')
      .addGroupBy('series.id')
      .orderBy('book.publishedAt', 'DESC');

    const result = await paginate(query, qb, {
      sortableColumns: ['publishedAt'],
      defaultSortBy: [['publishedAt', 'DESC']],
      defaultLimit: 20,
      maxLimit: 100,
    });

    if (result.data.length === 0) {
      return this.fallbackToFeatured(query, userId, userType);
    }

    return {
      ...result,
      data: this.sanitizeBooks(result.data, userId, userType),
    };
  }

  async trending(
    opts?: { limit?: number },
    userId?: string,
    userType?: UserType,
  ) {
    const limit = opts?.limit ?? 10;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const qb = this.createQueryBuilder()
      .innerJoin('book.applications', 'application')
      .where('book.status = :status', { status: BookStatus.ACTIVE })
      .andWhere('book.availableCopies > 0')
      .andWhere('book.applicationDeadline > :now', { now: new Date() })
      .andWhere('application.appliedAt >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('application.status != :withdrawn', { withdrawn: 'withdrawn' })
      .groupBy('book.id')
      .addGroupBy('author.id')
      .addGroupBy('series.id')
      .addSelect('COUNT(application.id)', 'applicationCount')
      .orderBy('applicationCount', 'DESC')
      .take(limit);

    const results = await qb.getRawAndEntities();
    return results.entities.map((book, index) => ({
      book: this.sanitizeBook(book, userId, userType),
      applicationCount: parseInt(
        results.raw[index]?.applicationCount || '0',
        10,
      ),
    }));
  }

  private createQueryBuilder(): SelectQueryBuilder<Book> {
    return this.bookRepo
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.author', 'author')
      .leftJoinAndSelect('book.series', 'series')
      .leftJoinAndSelect('book.bookGenres', 'bookGenres')
      .leftJoinAndSelect('bookGenres.genre', 'genre');
  }

  private hasComplexFilters(query: PaginateQuery): boolean {
    const {
      genres,
      minAvgRating,
      maxAvgRating,
      sortBy,
      applicationStatus,
      deadlineFilter,
    } = this.extractQueryParams(query);

    return (
      (genres?.length ?? 0) > 0 ||
      minAvgRating !== undefined ||
      maxAvgRating !== undefined ||
      (sortBy !== undefined && sortBy !== BookSortBy.NEWEST) ||
      applicationStatus !== undefined ||
      deadlineFilter !== undefined
    );
  }

  private buildSimpleWhere(query: PaginateQuery) {
    const { applicationStatus } = this.extractQueryParams(query);
    const where: any = {
      status: In([
        BookStatus.ACTIVE,
        BookStatus.IN_PROGRESS,
        BookStatus.COMPLETED,
      ]),
    };

    if (applicationStatus === ApplicationStatusFilter.ACCEPTING_APPLICATIONS) {
      where.availableCopies = MoreThan(0);
      where.applicationDeadline = MoreThan(new Date());
    }

    return where;
  }

  private async browseWithComplexFilters(
    query: PaginateQuery,
    userId?: string,
    userType?: UserType,
  ) {
    const qb = this.createQueryBuilder();
    const { sortBy } = this.extractQueryParams(query);

    this.addStatusFilter(qb);
    this.addAdvancedFilters(qb, query);
    this.addSorting(qb, sortBy);

    const result = await paginate(query, qb, this.getPaginateConfig());

    return {
      ...result,
      data: this.sanitizeBooks(result.data, userId, userType),
    };
  }

  private extractQueryParams(query: PaginateQuery) {
    return {
      genres: query['genres'] as number[] | undefined,
      minAvgRating: query['minAvgRating'] as number | undefined,
      maxAvgRating: query['maxAvgRating'] as number | undefined,
      sortBy: query['sortBy'] as BookSortBy | undefined,
      applicationStatus: query['applicationStatus'] as
        | ApplicationStatusFilter
        | undefined,
      deadlineFilter: query['deadlineFilter'] as DeadlineFilter | undefined,
    };
  }

  private addStatusFilter(qb: SelectQueryBuilder<Book>) {
    qb.andWhere('book.status IN (:...statuses)', {
      statuses: [
        BookStatus.ACTIVE,
        BookStatus.IN_PROGRESS,
        BookStatus.COMPLETED,
      ],
    });
  }

  private addAdvancedFilters(
    qb: SelectQueryBuilder<Book>,
    query: PaginateQuery,
  ) {
    const {
      genres,
      minAvgRating,
      maxAvgRating,
      applicationStatus,
      deadlineFilter,
    } = this.extractQueryParams(query);

    if (applicationStatus === ApplicationStatusFilter.ACCEPTING_APPLICATIONS) {
      qb.andWhere('book.availableCopies > 0');
      qb.andWhere('book.applicationDeadline > :now', { now: new Date() });
    }

    if (deadlineFilter) {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      if (deadlineFilter === DeadlineFilter.ENDING_SOON) {
        qb.andWhere('book.applicationDeadline <= :sevenDaysFromNow', {
          sevenDaysFromNow,
        });
        qb.andWhere('book.applicationDeadline > :now', { now: new Date() });
      } else if (deadlineFilter === DeadlineFilter.STILL_TIME) {
        qb.andWhere('book.applicationDeadline > :sevenDaysFromNow', {
          sevenDaysFromNow,
        });
      }
    }

    if (genres && genres.length > 0) {
      this.addGenreFilter(qb, genres);
    }

    if (minAvgRating !== undefined || maxAvgRating !== undefined) {
      this.addRatingFilter(qb, minAvgRating, maxAvgRating);
    }
  }

  private addGenreFilter(qb: SelectQueryBuilder<Book>, genres: number[]) {
    qb.andWhere((subQb) => {
      const subQuery = subQb
        .subQuery()
        .select('bg.book_id')
        .from('book_genres', 'bg')
        .where('bg.genre_id IN (:...genreIds)', { genreIds: genres })
        .groupBy('bg.book_id')
        .having('COUNT(DISTINCT bg.genre_id) = :genreCount', {
          genreCount: genres.length,
        })
        .getQuery();
      return `book.id IN ${subQuery}`;
    });
  }

  private addRatingFilter(
    qb: SelectQueryBuilder<Book>,
    minAvgRating?: number,
    maxAvgRating?: number,
  ) {
    qb.leftJoin(
      (subQb) => {
        return subQb
          .select('r.application_id', 'application_id')
          .addSelect('AVG(r.rating)', 'avg_rating')
          .from('reviews', 'r')
          .innerJoin('applications', 'a', 'a.id = r.application_id')
          .where('a.book_id = book.id')
          .groupBy('r.application_id');
      },
      'review_avg',
      'review_avg.application_id = application.id',
    );

    if (minAvgRating !== undefined) {
      qb.andHaving('AVG(review_avg.avg_rating) >= :minAvgRating', {
        minAvgRating,
      });
    }
    if (maxAvgRating !== undefined) {
      qb.andHaving('AVG(review_avg.avg_rating) <= :maxAvgRating', {
        maxAvgRating,
      });
    }
  }

  private addSorting(qb: SelectQueryBuilder<Book>, sortBy?: BookSortBy) {
    if (!sortBy || sortBy === BookSortBy.NEWEST) {
      qb.orderBy('book.publishedAt', 'DESC', 'NULLS LAST');
      return;
    }

    switch (sortBy) {
      case BookSortBy.MOST_POPULAR:
        qb.addSelect(
          (subQb) =>
            subQb
              .select('COUNT(a.id)')
              .from('applications', 'a')
              .where('a.book_id = book.id')
              .andWhere("a.status != 'withdrawn'"),
          'application_count',
        );
        qb.orderBy('application_count', 'DESC');
        qb.addOrderBy('book.publishedAt', 'DESC', 'NULLS LAST');
        break;

      case BookSortBy.HIGHEST_RATED:
        qb.addSelect(
          (subQb) =>
            subQb
              .select('AVG(r.rating)')
              .from('reviews', 'r')
              .innerJoin('applications', 'a', 'a.id = r.application_id')
              .where('a.book_id = book.id'),
          'avg_rating',
        );
        qb.orderBy('avg_rating', 'DESC', 'NULLS LAST');
        qb.addOrderBy('book.publishedAt', 'DESC', 'NULLS LAST');
        break;

      case BookSortBy.DEADLINE_SOONEST:
        qb.orderBy('book.applicationDeadline', 'ASC', 'NULLS LAST');
        qb.addOrderBy('book.publishedAt', 'DESC', 'NULLS LAST');
        break;

      case BookSortBy.MOST_AVAILABLE:
        qb.orderBy('book.availableCopies', 'DESC');
        qb.addOrderBy('book.publishedAt', 'DESC', 'NULLS LAST');
        break;
    }
  }

  private sanitizeBooks(
    books: Book[],
    userId?: string,
    userType?: UserType,
  ): Book[] {
    return books.map((book) => this.sanitizeBook(book, userId, userType));
  }

  private sanitizeBook(book: Book, userId?: string, userType?: UserType): Book {
    const isAuthor =
      userId && userType === UserType.AUTHOR && book.authorId === userId;
    if (!isAuthor) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fileUrl, fileSize, fileType, ...bookWithoutFiles } = book;
      return bookWithoutFiles as Book;
    }
    return book;
  }

  private async fallbackToFeatured(
    query: PaginateQuery,
    userId?: string,
    userType?: UserType,
  ) {
    const featured = await this.featured(userId, userType);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    return {
      data: featured.slice(skip, skip + limit),
      meta: {
        itemsPerPage: limit,
        totalItems: featured.length,
        currentPage: page,
        totalPages: Math.ceil(featured.length / limit),
      },
      links: {},
    };
  }
}
