import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Book } from '../entity/book.entity';
import { Genre } from '../../genres/entity/genre.entity';
import { Application } from '../../applications/entity/application.entity';
import { BrowseBooksDto } from '../dto/browse-books.dto';
import { ApplicationStatusFilter, DeadlineFilter, BookSortBy } from '../enums';
import { UserType } from '../../users/enums';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class BooksQueryService {
  private readonly logger = new Logger(BooksQueryService.name);

  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Genre) private readonly genreRepo: Repository<Genre>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async browse(
    dto: BrowseBooksDto,
    userId?: string,
    userType?: UserType,
  ): Promise<{
    data: Book[];
    total: number;
    skip: number;
    take: number;
    hasMore: boolean;
  }> {
    const skip = dto.skip ?? 0;
    const take = dto.take ?? 20;

    const normalizedGenreIds = this.normalizeGenreIds(dto.genres);

    const normalizedDto: BrowseBooksDto = {
      ...dto,
      genres: normalizedGenreIds,
      skip,
      take,
    };
    let query = `
      SELECT 
        b.id,
        b.title,
        b.cover_image_url,
        b.published_at,
        b.series_id,
        b.series_order,
        b.author_id,
        u.first_name,
        u.last_name,
        s.name as series_name,
        AVG(r.rating) as avg_rating
      FROM books b
      INNER JOIN users u ON u.id = b.author_id
      LEFT JOIN series s ON s.id = b.series_id
      LEFT JOIN reviews r ON r.application_id IN (
        SELECT a.id FROM applications a WHERE a.book_id = b.id
      )
      WHERE b.status = $1
    `;

    const queryParams: unknown[] = [normalizedDto.status ?? 'active'];
    let paramIndex = 2;

    const selectedGenreIds = normalizedGenreIds || [];

    if (normalizedDto.search) {
      query += ` AND (
        b.title ILIKE $${paramIndex} 
        OR b.short_description ILIKE $${paramIndex}
        OR b.full_description ILIKE $${paramIndex}
        OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramIndex}
        OR s.name ILIKE $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM book_genres bg 
          INNER JOIN genres g ON g.id = bg.genre_id 
          WHERE bg.book_id = b.id AND g.name ILIKE $${paramIndex}
        )
      )`;
      queryParams.push(`%${normalizedDto.search}%`);
      paramIndex++;
    }

    if (normalizedDto.title) {
      query += ` AND b.title ILIKE $${paramIndex}`;
      queryParams.push(`%${normalizedDto.title}%`);
      paramIndex++;
    }

    if (normalizedDto.authorName) {
      query += ` AND (u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramIndex})`;
      queryParams.push(`%${normalizedDto.authorName}%`);
      paramIndex++;
    }

    if (normalizedDto.authorId) {
      query += ` AND b.author_id = $${paramIndex}`;
      queryParams.push(normalizedDto.authorId);
      paramIndex++;
    }

    if (normalizedDto.seriesName) {
      query += ` AND s.name ILIKE $${paramIndex}`;
      queryParams.push(`%${normalizedDto.seriesName}%`);
      paramIndex++;
    }

    if (normalizedDto.seriesId) {
      query += ` AND b.series_id = $${paramIndex}`;
      queryParams.push(normalizedDto.seriesId);
      paramIndex++;
    }

    if (selectedGenreIds.length > 0) {
      if (selectedGenreIds.length === 1) {
        query += ` AND EXISTS (SELECT 1 FROM book_genres bg WHERE bg.book_id = b.id AND bg.genre_id = $${paramIndex})`;
        queryParams.push(selectedGenreIds[0]);
        paramIndex++;
      } else {
        query += ` AND (
          SELECT COUNT(DISTINCT bg.genre_id) 
          FROM book_genres bg 
          WHERE bg.book_id = b.id AND bg.genre_id = ANY($${paramIndex}::int[])
        ) = $${paramIndex + 1}`;
        queryParams.push(selectedGenreIds);
        queryParams.push(selectedGenreIds.length);
        paramIndex += 2;
      }
    }

    if (normalizedDto.ageRating) {
      query += ` AND b.age_rating = $${paramIndex}`;
      queryParams.push(normalizedDto.ageRating);
      paramIndex++;
    }

    if (normalizedDto.distributionType) {
      query += ` AND b.distribution_type = $${paramIndex}`;
      queryParams.push(normalizedDto.distributionType);
      paramIndex++;
    }

    if (normalizedDto.publishedFrom) {
      query += ` AND b.published_at >= $${paramIndex}`;
      queryParams.push(normalizedDto.publishedFrom);
      paramIndex++;
    }

    if (normalizedDto.publishedTo) {
      query += ` AND b.published_at <= $${paramIndex}`;
      queryParams.push(normalizedDto.publishedTo);
      paramIndex++;
    }

    if (normalizedDto.createdFrom) {
      query += ` AND b.created_at >= $${paramIndex}`;
      queryParams.push(normalizedDto.createdFrom);
      paramIndex++;
    }

    if (normalizedDto.createdTo) {
      query += ` AND b.created_at <= $${paramIndex}`;
      queryParams.push(normalizedDto.createdTo);
      paramIndex++;
    }

    if (
      normalizedDto.applicationStatus ===
      ApplicationStatusFilter.ACCEPTING_APPLICATIONS
    ) {
      query += ` AND b.available_copies > 0 AND b.application_deadline > NOW()`;
    }

    if (normalizedDto.deadlineFilter === DeadlineFilter.ENDING_SOON) {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      query += ` AND b.application_deadline <= $${paramIndex} AND b.application_deadline > NOW()`;
      queryParams.push(sevenDaysFromNow.toISOString());
      paramIndex++;
    } else if (normalizedDto.deadlineFilter === DeadlineFilter.STILL_TIME) {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      query += ` AND b.application_deadline > $${paramIndex}`;
      queryParams.push(sevenDaysFromNow.toISOString());
      paramIndex++;
    }

    query += `
      GROUP BY b.id, b.author_id, u.first_name, u.last_name, s.name, b.published_at, b.application_deadline, b.available_copies
    `;

    if (
      normalizedDto.minAvgRating !== undefined ||
      normalizedDto.maxAvgRating !== undefined
    ) {
      query += ` HAVING `;
      const havingConditions: string[] = [];
      if (normalizedDto.minAvgRating !== undefined) {
        havingConditions.push(`AVG(r.rating) >= $${paramIndex}`);
        queryParams.push(normalizedDto.minAvgRating);
        paramIndex++;
      }
      if (normalizedDto.maxAvgRating !== undefined) {
        havingConditions.push(`AVG(r.rating) <= $${paramIndex}`);
        queryParams.push(normalizedDto.maxAvgRating);
        paramIndex++;
      }
      query += havingConditions.join(' AND ');
    }

    const sortBy = normalizedDto.sortBy || BookSortBy.NEWEST;
    switch (sortBy) {
      case BookSortBy.MOST_POPULAR:
        query += ` ORDER BY (
          SELECT COUNT(*) FROM applications a 
          WHERE a.book_id = b.id AND a.status != 'withdrawn'
        ) DESC, b.published_at DESC NULLS LAST`;
        break;
      case BookSortBy.HIGHEST_RATED:
        query += ` ORDER BY AVG(r.rating) DESC NULLS LAST, b.published_at DESC NULLS LAST`;
        break;
      case BookSortBy.DEADLINE_SOONEST:
        query += ` ORDER BY b.application_deadline ASC NULLS LAST, b.published_at DESC NULLS LAST`;
        break;
      case BookSortBy.MOST_AVAILABLE:
        query += ` ORDER BY b.available_copies DESC, b.published_at DESC NULLS LAST`;
        break;
      case BookSortBy.NEWEST:
      default:
        query += ` ORDER BY b.published_at DESC NULLS LAST`;
        break;
    }

    if (normalizedDto.take !== undefined) {
      query += ` LIMIT $${paramIndex}`;
      queryParams.push(normalizedDto.take);
      paramIndex++;
    }

    if (normalizedDto.skip !== undefined) {
      query += ` OFFSET $${paramIndex}`;
      queryParams.push(normalizedDto.skip);
    }

    const needsReviewJoin =
      normalizedDto.minAvgRating !== undefined ||
      normalizedDto.maxAvgRating !== undefined;
    let countQuery = needsReviewJoin
      ? `
      SELECT COUNT(*) as total
      FROM (
        SELECT b.id
        FROM books b
        INNER JOIN users u ON u.id = b.author_id
        LEFT JOIN series s ON s.id = b.series_id
        LEFT JOIN reviews r ON r.application_id IN (
          SELECT a.id FROM applications a WHERE a.book_id = b.id
        )
        WHERE b.status = $1
    `
      : `
      SELECT COUNT(DISTINCT b.id) as total
      FROM books b
      INNER JOIN users u ON u.id = b.author_id
      LEFT JOIN series s ON s.id = b.series_id
      WHERE b.status = $1
    `;
    const countParams: unknown[] = [normalizedDto.status ?? 'active'];
    let countParamIndex = 2;

    if (normalizedDto.search) {
      countQuery += ` AND (
        b.title ILIKE $${countParamIndex} 
        OR b.short_description ILIKE $${countParamIndex}
        OR b.full_description ILIKE $${countParamIndex}
        OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${countParamIndex}
        OR s.name ILIKE $${countParamIndex}
        OR EXISTS (
          SELECT 1 FROM book_genres bg 
          INNER JOIN genres g ON g.id = bg.genre_id 
          WHERE bg.book_id = b.id AND g.name ILIKE $${countParamIndex}
        )
      )`;
      countParams.push(`%${normalizedDto.search}%`);
      countParamIndex++;
    }

    if (normalizedDto.title) {
      countQuery += ` AND b.title ILIKE $${countParamIndex}`;
      countParams.push(`%${normalizedDto.title}%`);
      countParamIndex++;
    }

    if (normalizedDto.authorName) {
      countQuery += ` AND (u.first_name ILIKE $${countParamIndex} OR u.last_name ILIKE $${countParamIndex} OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${countParamIndex})`;
      countParams.push(`%${normalizedDto.authorName}%`);
      countParamIndex++;
    }

    if (normalizedDto.authorId) {
      countQuery += ` AND b.author_id = $${countParamIndex}`;
      countParams.push(normalizedDto.authorId);
      countParamIndex++;
    }

    if (normalizedDto.seriesName) {
      countQuery += ` AND s.name ILIKE $${countParamIndex}`;
      countParams.push(`%${normalizedDto.seriesName}%`);
      countParamIndex++;
    }

    if (normalizedDto.seriesId) {
      countQuery += ` AND b.series_id = $${countParamIndex}`;
      countParams.push(normalizedDto.seriesId);
      countParamIndex++;
    }

    if (selectedGenreIds.length > 0) {
      if (selectedGenreIds.length === 1) {
        countQuery += ` AND EXISTS (SELECT 1 FROM book_genres bg WHERE bg.book_id = b.id AND bg.genre_id = $${countParamIndex})`;
        countParams.push(selectedGenreIds[0]);
        countParamIndex++;
      } else {
        countQuery += ` AND (
          SELECT COUNT(DISTINCT bg.genre_id) 
          FROM book_genres bg 
          WHERE bg.book_id = b.id AND bg.genre_id = ANY($${countParamIndex}::int[])
        ) = $${countParamIndex + 1}`;
        countParams.push(selectedGenreIds);
        countParams.push(selectedGenreIds.length);
        countParamIndex += 2;
      }
    }

    if (normalizedDto.ageRating) {
      countQuery += ` AND b.age_rating = $${countParamIndex}`;
      countParams.push(normalizedDto.ageRating);
      countParamIndex++;
    }

    if (normalizedDto.distributionType) {
      countQuery += ` AND b.distribution_type = $${countParamIndex}`;
      countParams.push(normalizedDto.distributionType);
      countParamIndex++;
    }

    if (normalizedDto.publishedFrom) {
      countQuery += ` AND b.published_at >= $${countParamIndex}`;
      countParams.push(normalizedDto.publishedFrom);
      countParamIndex++;
    }

    if (normalizedDto.publishedTo) {
      countQuery += ` AND b.published_at <= $${countParamIndex}`;
      countParams.push(normalizedDto.publishedTo);
      countParamIndex++;
    }

    if (normalizedDto.createdFrom) {
      countQuery += ` AND b.created_at >= $${countParamIndex}`;
      countParams.push(normalizedDto.createdFrom);
      countParamIndex++;
    }

    if (normalizedDto.createdTo) {
      countQuery += ` AND b.created_at <= $${countParamIndex}`;
      countParams.push(normalizedDto.createdTo);
      countParamIndex++;
    }

    if (
      normalizedDto.applicationStatus ===
      ApplicationStatusFilter.ACCEPTING_APPLICATIONS
    ) {
      countQuery += ` AND b.available_copies > 0 AND b.application_deadline > NOW()`;
    }

    if (normalizedDto.deadlineFilter === DeadlineFilter.ENDING_SOON) {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      countQuery += ` AND b.application_deadline <= $${countParamIndex} AND b.application_deadline > NOW()`;
      countParams.push(sevenDaysFromNow.toISOString());
      countParamIndex++;
    } else if (normalizedDto.deadlineFilter === DeadlineFilter.STILL_TIME) {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      countQuery += ` AND b.application_deadline > $${countParamIndex}`;
      countParams.push(sevenDaysFromNow.toISOString());
      countParamIndex++;
    }

    if (needsReviewJoin) {
      countQuery += ` GROUP BY b.id`;
      const havingConditions: string[] = [];
      if (normalizedDto.minAvgRating !== undefined) {
        havingConditions.push(`AVG(r.rating) >= $${countParamIndex}`);
        countParams.push(normalizedDto.minAvgRating);
        countParamIndex++;
      }
      if (normalizedDto.maxAvgRating !== undefined) {
        havingConditions.push(`AVG(r.rating) <= $${countParamIndex}`);
        countParams.push(normalizedDto.maxAvgRating);
        countParamIndex++;
      }
      if (havingConditions.length > 0) {
        countQuery += ` HAVING ${havingConditions.join(' AND ')}`;
      }
      countQuery += ` ) as filtered_books`;
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const total = parseInt(countResult[0]?.total || '0', 10);

    const results = await this.dataSource.query(query, queryParams);

    const bookIds = results.map((row: { id: string }) => row.id);
    const books =
      bookIds.length > 0
        ? await this.bookRepo.find({
            where: { id: In(bookIds) },
            relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
          })
        : [];

    const booksMap = new Map(books.map((b) => [b.id, b]));
    const orderedBooks = bookIds
      .map((id) => booksMap.get(id))
      .filter(Boolean) as Book[];

    const sanitizedBooks = orderedBooks.map((book) => {
      const isAuthor =
        userId && userType === UserType.AUTHOR && book.authorId === userId;
      if (!isAuthor) {
        const { fileUrl, fileSize, fileType, ...bookWithoutFiles } = book;
        return bookWithoutFiles as Book;
      }
      return book;
    });

    return createPaginatedResponse(sanitizedBooks, total, skip, take);
  }

  async featured(userId?: string, userType?: UserType): Promise<Book[]> {
    this.logger.log('Fetching featured books...');

    const query = `
      SELECT 
        b.id,
        b.title,
        b.cover_image_url,
        b.published_at,
        b.series_id,
        b.series_order,
        b.author_id,
        u.first_name,
        u.last_name,
        s.name as series_name,
        AVG(r.rating) as avg_rating
      FROM books b
      INNER JOIN users u ON u.id = b.author_id
      LEFT JOIN series s ON s.id = b.series_id
      LEFT JOIN reviews r ON r.application_id IN (
        SELECT a.id FROM applications a WHERE a.book_id = b.id
      )
      WHERE b.status = 'active'
        AND b.available_copies > 0
        AND b.application_deadline > NOW()
      GROUP BY b.id, b.author_id, u.first_name, u.last_name, s.name
      ORDER BY b.published_at DESC NULLS LAST
      LIMIT 10
    `;

    const results = await this.dataSource.query(query);

    const bookIds = results.map((row: { id: string }) => row.id);
    if (bookIds.length === 0) {
      return [];
    }

    const books = await this.bookRepo.find({
      where: { id: In(bookIds) },
      relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
      order: { publishedAt: 'DESC' },
    });

    const booksMap = new Map(books.map((b) => [b.id, b]));
    const orderedBooks = bookIds
      .map((id) => booksMap.get(id))
      .filter(Boolean) as Book[];

    const sanitizedBooks = orderedBooks.map((book) => {
      const isAuthor =
        userId && userType === UserType.AUTHOR && book.authorId === userId;
      if (!isAuthor) {
        const { fileUrl, fileSize, fileType, ...bookWithoutFiles } = book;
        return bookWithoutFiles as Book;
      }
      return book;
    });

    this.logger.log(`Featured books found: ${sanitizedBooks.length}`);
    return sanitizedBooks;
  }

  async recommendedForUser(
    userId: string,
    opts?: { skip?: number; take?: number },
    userType?: UserType,
  ): Promise<{
    data: Book[];
    total: number;
    skip: number;
    take: number;
    hasMore: boolean;
  }> {
    try {
      if (!userId) {
        this.logger.warn('No userId provided, falling back to featured books');
        const featured = await this.featured();
        const skip = opts?.skip ?? 0;
        const take = opts?.take ?? 20;
        return createPaginatedResponse(
          featured.slice(skip, skip + take),
          featured.length,
          skip,
          take,
        );
      }

      this.logger.debug(`Recommending for user: ${userId}`, opts);

      const skip = opts?.skip ?? 0;
      const take = opts?.take ?? 20;

      const userPreferences = await this.dataSource.query(
        `SELECT genre_id FROM user_genre_preferences WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId],
      );

      if (userPreferences.length === 0) {
        this.logger.log(
          'No personalized recommendations found, falling back to featured books',
        );
        const featured = await this.featured();
        return createPaginatedResponse(
          featured.slice(skip, skip + take),
          featured.length,
          skip,
          take,
        );
      }

      const genreIds = userPreferences.map(
        (p: { genre_id: number }) => p.genre_id,
      );
      const topGenreIds = genreIds.slice(0, 5);

      if (topGenreIds.length === 0) {
        this.logger.log(
          'No genre preferences found, falling back to featured books',
        );
        const featured = await this.featured();
        return createPaginatedResponse(
          featured.slice(skip, skip + take),
          featured.length,
          skip,
          take,
        );
      }

      const query = `
        SELECT DISTINCT b.id, b.published_at
        FROM books b
        INNER JOIN book_genres bg ON bg.book_id = b.id
        WHERE b.status = $1
          AND bg.genre_id = ANY($2::int[])
          AND b.available_copies > 0
          AND b.application_deadline > NOW()
        ORDER BY b.published_at DESC
        LIMIT $3 OFFSET $4
      `;

      const countQuery = `
        SELECT COUNT(DISTINCT b.id) as total
        FROM books b
        INNER JOIN book_genres bg ON bg.book_id = b.id
        WHERE b.status = $1
          AND bg.genre_id = ANY($2::int[])
          AND b.available_copies > 0
          AND b.application_deadline > NOW()
      `;

      const [results, countResult] = await Promise.all([
        this.dataSource.query(query, ['active', topGenreIds, take, skip]),
        this.dataSource.query(countQuery, ['active', topGenreIds]),
      ]);

      const bookIds = results.map((row: { id: string }) => row.id);
      const total = parseInt(countResult[0]?.total || '0', 10);

      if (bookIds.length === 0) {
        this.logger.log(
          'No personalized recommendations found, falling back to featured books',
        );
        const featured = await this.featured();
        return createPaginatedResponse(
          featured.slice(skip, skip + take),
          featured.length,
          skip,
          take,
        );
      }

      const books = await this.bookRepo.find({
        where: { id: In(bookIds) },
        relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
      });

      const booksMap = new Map(books.map((b) => [b.id, b]));
      const orderedBooks = bookIds
        .map((id) => booksMap.get(id))
        .filter(Boolean) as Book[];

      const sanitizedBooks = orderedBooks.map((book) => {
        const isAuthor =
          userId && userType === UserType.AUTHOR && book.authorId === userId;
        if (!isAuthor) {
          const sanitized = Object.assign({}, book);
          sanitized.fileUrl = undefined;
          sanitized.fileSize = undefined;
          sanitized.fileType = undefined;

          book.fileUrl = undefined;
          book.fileSize = undefined;
          book.fileType = undefined;
          return sanitized;
        }
        return book;
      });

      this.logger.log(`Recommended books found: ${sanitizedBooks.length}`);
      return createPaginatedResponse(sanitizedBooks, total, skip, take);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error in recommendedForUser for user ${userId}: ${errorMessage}`,
        errorStack,
      );
      this.logger.log('Falling back to featured books due to error');
      try {
        const featured = await this.featured(userId, userType);
        const skip = opts?.skip ?? 0;
        const take = opts?.take ?? 20;
        return createPaginatedResponse(
          featured.slice(skip, skip + take),
          featured.length,
          skip,
          take,
        );
      } catch (fallbackError) {
        this.logger.error(
          'Error in featured books fallback:',
          fallbackError instanceof Error ? fallbackError.stack : fallbackError,
        );

        const skip = opts?.skip ?? 0;
        const take = opts?.take ?? 20;
        return createPaginatedResponse([], 0, skip, take);
      }
    }
  }

  async trending(
    opts?: { limit?: number },
    userId?: string,
    userType?: UserType,
  ): Promise<
    Array<{
      book: Book;
      applicationCount: number;
    }>
  > {
    const limit = opts?.limit ?? 10;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    this.logger.log(
      `Fetching trending books (applications since ${sevenDaysAgo.toISOString()})`,
    );

    const query = `
      SELECT 
        b.id,
        COUNT(a.id) as application_count
      FROM books b
      INNER JOIN applications a ON a.book_id = b.id
      WHERE b.status = 'active'
        AND b.available_copies > 0
        AND b.application_deadline > NOW()
        AND a.applied_at >= $1
        AND a.status != 'withdrawn'
      GROUP BY b.id
      ORDER BY application_count DESC
      LIMIT $2
    `;

    const results = await this.dataSource.query(query, [
      sevenDaysAgo.toISOString(),
      limit,
    ]);

    if (results.length === 0) {
      this.logger.log('No trending books found');
      return [];
    }

    const bookIds = results.map((row: { id: string }) => row.id);
    const applicationCounts = new Map(
      results.map((row: { id: string; application_count: string }) => [
        row.id,
        parseInt(row.application_count, 10),
      ]),
    );

    const books = await this.bookRepo.find({
      where: { id: In(bookIds) },
      relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
    });

    const sanitizedBooks = books.map((book) => {
      const isAuthor =
        userId && userType === UserType.AUTHOR && book.authorId === userId;
      if (!isAuthor) {
        const { fileUrl, fileSize, fileType, ...bookWithoutFiles } = book;
        return bookWithoutFiles as Book;
      }
      return book;
    });

    const booksMap = new Map(sanitizedBooks.map((b) => [b.id, b]));
    const trendingBooks = bookIds
      .map((id) => {
        const book = booksMap.get(id);
        if (!book) return null;
        return {
          book,
          applicationCount: applicationCounts.get(id) || 0,
        };
      })
      .filter(Boolean) as Array<{ book: Book; applicationCount: number }>;

    this.logger.log(`Trending books found: ${trendingBooks.length}`);
    return trendingBooks;
  }

  private normalizeGenreIds(genres?: number | number[]): number[] | undefined {
    if (!genres) {
      return undefined;
    }

    if (typeof genres === 'number') {
      return [genres];
    }

    if (Array.isArray(genres)) {
      return genres.filter((g) => typeof g === 'number' && !isNaN(g) && g > 0);
    }

    return undefined;
  }
}
