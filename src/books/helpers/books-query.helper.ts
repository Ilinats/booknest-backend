import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  SelectQueryBuilder,
  In,
  MoreThan,
  FindOptionsWhere,
} from 'typeorm';
import { PaginateQuery, paginate, FilterOperator } from 'nestjs-paginate';
import { Book } from '../entity/book.entity';
import { BookGenre } from '../entity/book-genre.entity';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { UserGenrePreference } from '../../user-genre-preferences/entity/user-genre-preference.entity';
import { BookStatus } from '../enums';
import { UserType } from '../../users/enums';
import { ApplicationStatus } from '../../applications/enums';

const BROWSE_SEARCH_BY = [
  'title',
  'author.firstName',
  'author.lastName',
  'series.name',
] as const;

@Injectable()
export class BooksQueryHelper {
  private getPaginateConfig() {
    return {
      sortableColumns: [
        'publishedAt',
        'createdAt',
        'title',
        'status',
        'applicationDeadline',
        'availableCopies',
        'author.firstName',
        'series.name',
      ] as any[],
      searchableColumns: [...BROWSE_SEARCH_BY] as any[],
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
        'bookGenres.genreId': [FilterOperator.EQ, FilterOperator.IN],
        availableCopies: [FilterOperator.GT],
        applicationDeadline: [
          FilterOperator.GT,
          FilterOperator.LTE,
          FilterOperator.BTW,
        ],
      },
      defaultSortBy: [['publishedAt', 'DESC']] as any,
      defaultLimit: 20,
      maxLimit: 100,
    };
  }

  private getBrowsePaginateConfig() {
    return {
      ...this.getPaginateConfig(),
      where: {
        status: In([
          BookStatus.ACTIVE,
          BookStatus.IN_PROGRESS,
          BookStatus.COMPLETED,
        ]),
      },
      relations: {
        author: true,
        series: true,
        bookGenres: { genre: true },
      },
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

  async browse(
    paginateQuery: PaginateQuery,
    userId?: string,
    userType?: UserType,
  ) {
    const query = this.withBrowseDefaults(paginateQuery);

    if (this.needsCustomSql(query)) {
      return this.browseWithCustomQuery(query, userId, userType);
    }

    const result = await paginate(
      query,
      this.bookRepo,
      this.getBrowsePaginateConfig(),
    );

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
    const page = query.page ?? 1;
    const take = (query as PaginateQuery & { take?: number }).take;
    const limit = Math.min(Number(query.limit ?? take ?? 20), 100);

    let genreIds: number[] = [];
    if (userId) {
      const prefs = await this.userGenrePrefRepo.find({
        where: { user: { id: userId } },
        relations: ['genre'],
        order: { createdAt: 'DESC' },
        take: 5,
      });
      genreIds = prefs
        .map((p) => p.genre?.id)
        .filter((id): id is number => id != null);
    }

    let result = await this.findAcceptingBooks({ genreIds, page, limit });

    if (result.data.length === 0 && genreIds.length > 0) {
      result = await this.findAcceptingBooks({ page, limit });
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

    const rows = await this.applicationRepo
      .createQueryBuilder('application')
      .innerJoin('application.book', 'book')
      .select('book.id', 'bookId')
      .addSelect('COUNT(application.id)', 'applicationCount')
      .where('book.status = :status', { status: BookStatus.ACTIVE })
      .andWhere('book.availableCopies > 0')
      .andWhere('book.applicationDeadline > :now', { now: new Date() })
      .andWhere('application.appliedAt >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('application.status != :withdrawn', {
        withdrawn: ApplicationStatus.WITHDRAWN,
      })
      .groupBy('book.id')
      .orderBy('COUNT(application.id)', 'DESC')
      .limit(limit)
      .getRawMany<{ bookId: string; applicationCount: string }>();

    if (rows.length === 0) {
      return [];
    }

    const books = await this.bookRepo.find({
      where: { id: In(rows.map((row) => row.bookId)) },
      relations: this.BOOK_RELATIONS,
    });
    const booksById = new Map(books.map((book) => [book.id, book]));

    return rows
      .map((row) => {
        const book = booksById.get(row.bookId);
        if (!book) {
          return null;
        }
        return {
          book: this.sanitizeBook(book, userId, userType),
          applicationCount: parseInt(row.applicationCount, 10) || 0,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }

  private createQueryBuilder(): SelectQueryBuilder<Book> {
    return this.bookRepo
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.author', 'author')
      .leftJoinAndSelect('book.series', 'series')
      .leftJoinAndSelect('book.bookGenres', 'bookGenres')
      .leftJoinAndSelect('bookGenres.genre', 'genre');
  }

  private withBrowseDefaults(query: PaginateQuery): PaginateQuery {
    const search = query.search?.trim();
    return {
      ...query,
      sortBy: query.sortBy?.length ? query.sortBy : [['publishedAt', 'DESC']],
      search: search || undefined,
      searchBy: search ? [...BROWSE_SEARCH_BY] : query.searchBy,
    };
  }

  private needsCustomSql(query: PaginateQuery): boolean {
    const sortField = query.sortBy?.[0]?.[0]?.toLowerCase();
    if (sortField === 'mostpopular' || sortField === 'averagerating') {
      return true;
    }
    const range = this.ratingRangeFrom(query.filter?.averageRating);
    return range != null && (range.min > 0 || range.max < 5);
  }

  private ratingRangeFrom(
    raw: unknown,
  ): { min: number; max: number } | undefined {
    if (typeof raw !== 'string') {
      return undefined;
    }
    const btw = raw.match(/^\$btw:([\d.]+),([\d.]+)$/);
    if (btw) {
      return { min: Number(btw[1]), max: Number(btw[2]) };
    }
    const min = raw.match(/^\$gte:([\d.]+)$/)?.[1];
    const max = raw.match(/^\$lte:([\d.]+)$/)?.[1];
    if (min || max) {
      return { min: min ? Number(min) : 0, max: max ? Number(max) : 5 };
    }
    return undefined;
  }

  private genreIdsFromFilter(
    filter?: PaginateQuery['filter'],
  ): number[] | undefined {
    const raw = filter?.['bookGenres.genreId'];
    if (typeof raw !== 'string') {
      return undefined;
    }
    const match = /^\$(eq|in):(.*)$/.exec(raw);
    if (!match) {
      return undefined;
    }
    const values = match[1] === 'eq' ? [match[2]] : match[2].split(',');
    const ids = values
      .map((v) => parseInt(v.trim(), 10))
      .filter((id) => !Number.isNaN(id));
    return ids.length > 0 ? ids : undefined;
  }

  private async browseWithCustomQuery(
    query: PaginateQuery,
    userId?: string,
    userType?: UserType,
  ) {
    const qb = this.bookRepo.createQueryBuilder('book');
    qb.andWhere('book.status IN (:...statuses)', {
      statuses: [
        BookStatus.ACTIVE,
        BookStatus.IN_PROGRESS,
        BookStatus.COMPLETED,
      ],
    });

    this.applyBrowseFiltersToQueryBuilder(qb, query);

    const range = this.ratingRangeFrom(query.filter?.averageRating);
    if (range && (range.min > 0 || range.max < 5)) {
      this.addRatingFilter(qb, range.min, range.max);
    }

    this.addSorting(qb, query.sortBy);

    const pagination = await this.paginateBookIds(qb, query);
    const books = await this.loadBooksByIds(pagination.ids);

    return this.buildPaginatedBooksResponse(
      books,
      pagination,
      userId,
      userType,
    );
  }

  private applyBrowseFiltersToQueryBuilder(
    qb: SelectQueryBuilder<Book>,
    query: PaginateQuery,
  ) {
    const genreIds = this.genreIdsFromFilter(query.filter);
    if (genreIds?.length) {
      this.addGenreFilter(qb, genreIds);
    }

    const f = query.filter ?? {};
    if (typeof f.ageRating === 'string' && f.ageRating.startsWith('$eq:')) {
      qb.andWhere('book.ageRating = :ageRating', {
        ageRating: f.ageRating.slice(4),
      });
    }
    if (
      typeof f.distributionType === 'string' &&
      f.distributionType.startsWith('$eq:')
    ) {
      qb.andWhere('book.distributionType = :distributionType', {
        distributionType: f.distributionType.slice(4),
      });
    }
    if (
      typeof f.availableCopies === 'string' &&
      f.availableCopies.startsWith('$gt:')
    ) {
      qb.andWhere('book.availableCopies > :minCopies', {
        minCopies: Number(f.availableCopies.slice(4)),
      });
    }
    if (typeof f.applicationDeadline === 'string') {
      this.applyApplicationDeadlineFilter(qb, f.applicationDeadline);
    }
  }

  private applyApplicationDeadlineFilter(
    qb: SelectQueryBuilder<Book>,
    expression: string,
  ) {
    const btw = expression.match(/^\$btw:(.+),(.+)$/);
    if (btw) {
      qb.andWhere('book.applicationDeadline BETWEEN :deadlineFrom AND :deadlineTo', {
        deadlineFrom: new Date(btw[1]),
        deadlineTo: new Date(btw[2]),
      });
      return;
    }
    if (expression.startsWith('$gt:')) {
      qb.andWhere('book.applicationDeadline > :deadlineAfter', {
        deadlineAfter: new Date(expression.slice(4)),
      });
      return;
    }
    if (expression.startsWith('$lte:')) {
      qb.andWhere('book.applicationDeadline <= :deadlineBefore', {
        deadlineBefore: new Date(expression.slice(5)),
      });
    }
  }

  private addGenreFilter(qb: SelectQueryBuilder<Book>, genres: number[]) {
    qb.andWhere((subQb) => {
      const subQuery = subQb
        .subQuery()
        .select('bg.book_id')
        .from('book_genres', 'bg')
        .where('bg.genre_id IN (:...genreIds)', { genreIds: genres })
        .getQuery();
      return `book.id IN ${subQuery}`;
    });
  }

  private addRatingFilter(
    qb: SelectQueryBuilder<Book>,
    minAvgRating?: number,
    maxAvgRating?: number,
  ) {
    const avgRatingSubquery = `(
      SELECT AVG(r.rating)
      FROM reviews r
      INNER JOIN applications a ON a.id = r.application_id
      WHERE a.book_id = book.id
    )`;

    if (minAvgRating !== undefined) {
      qb.andWhere(`${avgRatingSubquery} >= :minAvgRating`, { minAvgRating });
    }
    if (maxAvgRating !== undefined) {
      qb.andWhere(`${avgRatingSubquery} <= :maxAvgRating`, { maxAvgRating });
    }
  }

  private addSorting(
    qb: SelectQueryBuilder<Book>,
    sortBy?: PaginateQuery['sortBy'],
  ) {
    const field = sortBy?.[0]?.[0]?.toLowerCase() ?? 'publishedat';
    const dir = (sortBy?.[0]?.[1]?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as
      | 'ASC'
      | 'DESC';

    switch (field) {
      case 'mostpopular':
        qb.orderBy(
          `(SELECT COUNT(a.id) FROM applications a WHERE a.book_id = book.id AND a.status != 'withdrawn')`,
          'DESC',
        );
        qb.addOrderBy('book.publishedAt', 'DESC', 'NULLS LAST');
        break;

      case 'averagerating':
        qb.orderBy(
          `(SELECT AVG(r.rating) FROM reviews r INNER JOIN applications a ON a.id = r.application_id WHERE a.book_id = book.id)`,
          'DESC',
          'NULLS LAST',
        );
        qb.addOrderBy('book.publishedAt', 'DESC', 'NULLS LAST');
        break;

      case 'applicationdeadline':
        qb.orderBy('book.applicationDeadline', dir, 'NULLS LAST');
        qb.addOrderBy('book.publishedAt', 'DESC', 'NULLS LAST');
        break;

      case 'availablecopies':
        qb.orderBy('book.availableCopies', dir);
        qb.addOrderBy('book.publishedAt', 'DESC', 'NULLS LAST');
        break;

      default:
        qb.orderBy('book.publishedAt', 'DESC', 'NULLS LAST');
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

  private async findAcceptingBooks(opts: {
    genreIds?: number[];
    page: number;
    limit: number;
  }) {
    const where: FindOptionsWhere<Book> = {
      status: BookStatus.ACTIVE,
      availableCopies: MoreThan(0),
      applicationDeadline: MoreThan(new Date()),
    };

    if (opts.genreIds?.length) {
      where.bookGenres = { genreId: In(opts.genreIds) };
    }

    const [data, totalItems] = await this.bookRepo.findAndCount({
      where,
      relations: this.BOOK_RELATIONS,
      order: { publishedAt: 'DESC' },
      take: opts.limit,
      skip: (opts.page - 1) * opts.limit,
    });

    return {
      data,
      meta: {
        itemsPerPage: opts.limit,
        totalItems,
        currentPage: opts.page,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / opts.limit),
      },
      links: {},
    };
  }

  private async paginateBookIds(
    qb: SelectQueryBuilder<Book>,
    query: PaginateQuery,
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(1, query.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    const totalItems = await qb.clone().getCount();
    const ids = (
      await qb
        .clone()
        .select('book.id', 'id')
        .offset(skip)
        .limit(limit)
        .getRawMany<{ id: string }>()
    ).map((row) => row.id);

    return {
      ids,
      page,
      limit,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / limit),
    };
  }

  private async loadBooksByIds(ids: string[]): Promise<Book[]> {
    if (ids.length === 0) {
      return [];
    }

    const books = await this.bookRepo.find({
      where: { id: In(ids) },
      relations: this.BOOK_RELATIONS,
    });

    const order = new Map(ids.map((id, index) => [id, index]));
    books.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return books;
  }

  private buildPaginatedBooksResponse(
    books: Book[],
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
    },
    userId?: string,
    userType?: UserType,
  ) {
    return {
      data: this.sanitizeBooks(books, userId, userType),
      meta: {
        itemsPerPage: pagination.limit,
        totalItems: pagination.totalItems,
        currentPage: pagination.page,
        totalPages: pagination.totalPages,
      },
      links: {},
    };
  }
}
