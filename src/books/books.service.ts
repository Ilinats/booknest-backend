import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In, Not, IsNull } from 'typeorm';
import { Book } from './entity/book.entity';
import { Series } from '../series/entity/series.entity';
import { BookGenre } from './entity/book-genre.entity';
import { CreateBookDto, UpdateBookDto, BrowseBooksDto } from './dto';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { User } from '../users/entity/user.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { UserGenrePreference } from '../user-genre-preferences/entity/user-genre-preference.entity';
import { Genre } from '../genres/entity/genre.entity';
import { FilesService } from '../files/files.service';
import { SelectionMethod, BookStatus, DistributionType } from './enums';
import { BasePaginationDto, createPaginatedResponse } from '../common';
import { BookErrorCode, BookErrors } from './errors/book-errors';
import { ensureAuthor } from '../common/utils/auth.util';
import { UserType } from '../users/enums';
import { BooksQueryService } from './services/books-query.service';
import { BooksAnalyticsService } from './services/books-analytics.service';
import { BooksFileService } from './services/books-file.service';
import { ApplicationStatus } from '../applications/enums';

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Series) private readonly seriesRepo: Repository<Series>,
    @InjectRepository(BookGenre)
    private readonly bookGenreRepo: Repository<BookGenre>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepo: Repository<UserAddress>,
    @InjectRepository(UserGenrePreference)
    private readonly userGenrePrefRepo: Repository<UserGenrePreference>,
    @InjectRepository(Genre) private readonly genreRepo: Repository<Genre>,
    private readonly filesService: FilesService,
    private readonly booksQueryService: BooksQueryService,
    private readonly booksAnalyticsService: BooksAnalyticsService,
    private readonly booksFileService: BooksFileService,
  ) {}

  async create(
    authorId: string,
    authorUserType: UserType | undefined,
    dto: CreateBookDto,
  ): Promise<Book> {
    await this.ensureSeriesOwnershipIfProvided(authorId, dto.seriesId);
    const totalCopies = dto.totalCopies ?? 1;
    const availableCopies = dto.availableCopies ?? totalCopies;
    if (availableCopies > totalCopies || availableCopies < 0) {
      const error = BookErrors[BookErrorCode.BOOK_INVALID_COPIES];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    const applicationDeadline = new Date(dto.applicationDeadline);
    const reviewDeadline = dto.reviewDeadline
      ? new Date(dto.reviewDeadline)
      : null;

    if (reviewDeadline && reviewDeadline <= applicationDeadline) {
      const error = BookErrors[BookErrorCode.BOOK_INVALID_DEADLINE];
      throw new BadRequestException({
        message: error.message,
        code: error.code,
      });
    }

    const book = this.bookRepo.create({
      authorId,
      title: dto.title,
      shortDescription: dto.shortDescription ?? null,
      fullDescription: dto.fullDescription ?? null,

      coverImageUrl: null,
      pageCount: dto.pageCount ?? null,
      ageRating: dto.ageRating,
      distributionType: dto.distributionType,
      fileUrl: null,
      fileSize: null,
      fileType: null,
      totalCopies,
      availableCopies,
      applicationDeadline,
      reviewDeadline,
      selectionCriteria: dto.selectionCriteria ?? null,
      selectionMethod: dto.selectionMethod ?? SelectionMethod.AUTHOR_SELECTS,
      seriesId: dto.seriesId ?? null,
      seriesOrder: dto.seriesOrder ?? null,
    });
    const saved = await this.bookRepo.save(book);
    if (dto.genres?.length) {
      const genreIds = dto.genres;
      const genres = await this.genreRepo.find({ where: { id: In(genreIds) } });
      if (genres.length !== genreIds.length) {
        const foundIds = genres.map((g) => g.id);
        const missing = genreIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(
          `Invalid genre IDs: ${missing.join(', ')}`,
        );
      }
      const bgs = genreIds.map((genreId) =>
        this.bookGenreRepo.create({ bookId: saved.id, genreId }),
      );
      await this.bookGenreRepo.save(bgs);
    }
    return (
      (await this.bookRepo.findOne({
        where: { id: saved.id },
        relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
      })) || saved
    );
  }

  async createWithFile(
    authorId: string,
    authorUserType: UserType | undefined,
    dto: CreateBookDto,
    file: Express.Multer.File | undefined,
  ): Promise<Book> {
    const book = await this.create(authorId, authorUserType, dto);

    if (dto.distributionType !== DistributionType.PHYSICAL) {
      if (!file) {
        const error = BookErrors[BookErrorCode.BOOK_FILE_NOT_AVAILABLE];
        throw new BadRequestException({
          message: 'File is required for digital or both distribution types',
          code: error.code,
        });
      }
      const result = await this.booksFileService.uploadBookFile(
        authorId,
        authorUserType,
        book.id,
        file,
      );
      return result.book;
    }

    if (file) {
      const result = await this.booksFileService.uploadBookFile(
        authorId,
        authorUserType,
        book.id,
        file,
      );
      return result.book;
    }

    return book;
  }

  async ensureSeriesOwnershipIfProvided(authorId: string, seriesId?: string) {
    if (!seriesId) return;
    const series = await this.seriesRepo.findOne({ where: { id: seriesId } });
    if (!series || series.authorId !== authorId) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_OWNED_BY_AUTHOR];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }
  }

  async findMy(authorId: string, sortBy?: string): Promise<Book[]> {
    const books = await this.bookRepo.find({
      where: { authorId },
      relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
    });

    if (sortBy === 'application_count') {
      const bookIds = books.map((book) => book.id);
      const applicationCounts = await this.applicationRepo
        .createQueryBuilder('application')
        .select('application.bookId', 'bookId')
        .addSelect('COUNT(application.id)', 'count')
        .where('application.bookId IN (:...bookIds)', { bookIds })
        .andWhere('application.status != :withdrawnStatus', {
          withdrawnStatus: 'withdrawn',
        })
        .groupBy('application.bookId')
        .getRawMany();

      const countMap = new Map(
        applicationCounts.map((row) => [row.bookId, parseInt(row.count, 10)]),
      );

      books.sort((a, b) => {
        const countA = countMap.get(a.id) || 0;
        const countB = countMap.get(b.id) || 0;
        if (countB !== countA) {
          return countB - countA;
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      return books;
    }

    switch (sortBy) {
      case 'title':
        books.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'status':
        books.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case 'date_created':
      default:
        books.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
    }

    return books;
  }

  async findBySeries(seriesId: string): Promise<Book[]> {
    return await this.bookRepo.find({
      where: { seriesId, status: BookStatus.ACTIVE },
      relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
      order: { seriesOrder: 'ASC', publishedAt: 'DESC' },
    });
  }

  async getBooksWithApproachingDeadline(
    authorId: string,
    days: number = 7,
  ): Promise<Book[]> {
    const now = new Date();
    const deadlineThreshold = new Date();
    deadlineThreshold.setDate(deadlineThreshold.getDate() + days);

    return await this.bookRepo
      .find({
        where: {
          authorId,
          status: BookStatus.ACTIVE,
        },
        relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
        order: { applicationDeadline: 'ASC' },
      })
      .then((books) =>
        books.filter(
          (book) =>
            book.applicationDeadline > now &&
            book.applicationDeadline <= deadlineThreshold,
        ),
      );
  }

  async findOnePublic(
    bookId: string,
    userId?: string,
    userType?: UserType,
  ): Promise<Book> {
    try {
      const book = await this.bookRepo.findOne({
        where: { id: bookId },
        relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
      });

      if (!book) {
        const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
        throw new NotFoundException({
          message: error.message,
          code: error.code,
        });
      }

      const isAuthor =
        userId && userType === UserType.AUTHOR && book.authorId === userId;
      if (!isAuthor) {
        delete book.fileUrl;
        delete book.fileSize;
        delete book.fileType;
      }

      return book;
    } catch (error) {
      this.logger.error('Error in findOnePublic:', error);
      throw error;
    }
  }

  async update(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    dto: UpdateBookDto & Partial<CreateBookDto>,
  ): Promise<Book> {
    ensureAuthor(authorUserType);
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
    await this.ensureSeriesOwnershipIfProvided(authorId, dto.seriesId);

    if (dto.title !== undefined) {
      book.title = dto.title;
    }
    if (dto.shortDescription !== undefined) {
      book.shortDescription = dto.shortDescription;
    }
    if (dto.fullDescription !== undefined) {
      book.fullDescription = dto.fullDescription;
    }
    if (dto.pageCount !== undefined) {
      book.pageCount = dto.pageCount;
    }
    if (dto.ageRating !== undefined) {
      book.ageRating = dto.ageRating;
    }
    if (dto.distributionType !== undefined) {
      book.distributionType = dto.distributionType;
    }
    if (dto.totalCopies !== undefined) {
      book.totalCopies = dto.totalCopies;
    }
    if (dto.availableCopies !== undefined) {
      book.availableCopies = dto.availableCopies;
    }
    if (dto.selectionCriteria !== undefined) {
      book.selectionCriteria = dto.selectionCriteria;
    }
    if (dto.selectionMethod !== undefined) {
      book.selectionMethod = dto.selectionMethod;
    }
    if (dto.seriesId !== undefined) {
      book.seriesId = dto.seriesId;
    }
    if (dto.seriesOrder !== undefined) {
      book.seriesOrder = dto.seriesOrder;
    }

    if (dto.applicationDeadline !== undefined) {
      book.applicationDeadline = new Date(dto.applicationDeadline);
    }
    if (dto.reviewDeadline !== undefined) {
      book.reviewDeadline = dto.reviewDeadline
        ? new Date(dto.reviewDeadline)
        : null;
    }

    if (
      book.reviewDeadline &&
      book.reviewDeadline <= book.applicationDeadline
    ) {
      const error = BookErrors[BookErrorCode.BOOK_INVALID_DEADLINE];
      throw new BadRequestException({
        message: error.message,
        code: error.code,
      });
    }

    if (book.availableCopies > book.totalCopies || book.availableCopies < 0) {
      const error = BookErrors[BookErrorCode.BOOK_INVALID_COPIES];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    await this.bookRepo.save(book);
    if (dto.genres !== undefined) {
      await this.bookGenreRepo.delete({ bookId: bookId });
      if (dto.genres && dto.genres.length) {
        const genreIds = dto.genres;
        const genres = await this.genreRepo.find({
          where: { id: In(genreIds) },
        });
        if (genres.length !== genreIds.length) {
          const foundIds = genres.map((g) => g.id);
          const missing = genreIds.filter((id) => !foundIds.includes(id));
          throw new BadRequestException(
            `Invalid genre IDs: ${missing.join(', ')}`,
          );
        }
        const bgs = genreIds.map((genreId) =>
          this.bookGenreRepo.create({ bookId, genreId }),
        );
        await this.bookGenreRepo.save(bgs);
      }
    }

    return this.findOnePublic(bookId, authorId, authorUserType);
  }

  async remove(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
  ) {
    ensureAuthor(authorUserType);
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }
    if (book.authorId !== authorId) {
      const error = BookErrors[BookErrorCode.BOOK_CANNOT_DELETE_OTHERS];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    const deletePromises: Promise<void>[] = [];

    if (book.fileUrl) {
      deletePromises.push(this.filesService.deleteFileByUrl(book.fileUrl));
    }

    if (book.coverImageUrl) {
      deletePromises.push(
        this.filesService.deleteFileByUrl(book.coverImageUrl),
      );
    }

    await Promise.allSettled(deletePromises);

    await this.bookRepo.delete(bookId);
  }

  async publish(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
  ) {
    ensureAuthor(authorUserType);
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
    book.status = BookStatus.ACTIVE;
    book.publishedAt = new Date();
    await this.bookRepo.save(book);

    return this.findOnePublic(bookId, authorId, authorUserType);
  }

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
    return this.booksQueryService.browse(dto, userId, userType);
  }

  async featured(userId?: string, userType?: UserType): Promise<Book[]> {
    return this.booksQueryService.featured(userId, userType);
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
    return this.booksQueryService.recommendedForUser(userId, opts, userType);
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
    return this.booksQueryService.trending(opts, userId, userType);
  }

  async searchSuggestions(
    query: string,
    limit: number = 10,
  ): Promise<{
    books: Array<{ id: string; title: string }>;
    authors: Array<{ id: string; name: string }>;
    series: Array<{ id: string; name: string }>;
  }> {
    return this.booksQueryService.searchSuggestions(query, limit);
  }

  async stats(authorId: string, bookId: string) {
    return this.booksAnalyticsService.stats(authorId, bookId);
  }

  async analytics(authorId: string, bookId: string) {
    return this.booksAnalyticsService.analytics(authorId, bookId);
  }

  async getAuthorAnalytics(authorId: string, dateRange?: string) {
    return this.booksAnalyticsService.getAuthorAnalytics(authorId, dateRange);
  }

  async getBookPerformanceComparison(authorId: string) {
    return this.booksAnalyticsService.getBookPerformanceComparison(authorId);
  }

  async updateFileInfo(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    fileUrl: string,
    fileSize: number,
    fileType: string,
  ): Promise<Book> {
    return this.booksFileService.updateFileInfo(
      authorId,
      authorUserType,
      bookId,
      fileUrl,
      fileSize,
      fileType,
    );
  }

  async updateCoverImage(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    coverImageUrl: string,
  ) {
    return this.booksFileService.updateCoverImage(
      authorId,
      authorUserType,
      bookId,
      coverImageUrl,
    );
  }

  async uploadBookFile(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    file: Express.Multer.File,
  ) {
    return this.booksFileService.uploadBookFile(
      authorId,
      authorUserType,
      bookId,
      file,
    );
  }

  async uploadCoverImage(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    file: Express.Multer.File,
  ) {
    return this.booksFileService.uploadCoverImage(
      authorId,
      authorUserType,
      bookId,
      file,
    );
  }

  async removeCoverImage(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
  ) {
    return this.booksFileService.removeCoverImage(
      authorId,
      authorUserType,
      bookId,
    );
  }

  async findOneForAuthor(authorId: string, bookId: string): Promise<Book> {
    const book = await this.bookRepo.findOne({
      where: { id: bookId, authorId },
    });

    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_OWNED_BY_AUTHOR];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    return book;
  }

  async checkUserApplicationStatus(
    userId: string,
    bookId: string,
  ): Promise<boolean> {
    const application = await this.applicationRepo.findOne({
      where: {
        readerId: userId,
        bookId: bookId,
        status: ApplicationStatus.APPROVED,
      },
    });

    return !!application;
  }

  async getBookAllReviews(
    userId: string,
    userType: UserType | undefined,
    bookId: string,
    pagination: BasePaginationDto,
  ) {
    const skip = pagination.skip ?? 0;
    const take = pagination.take ?? 20;

    if (userType === UserType.AUTHOR) {
      ensureAuthor(userType);
      const book = await this.findOneForAuthor(userId, bookId);

      if (!book) {
        const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
        throw new NotFoundException({
          message: error.message,
          code: error.code,
        });
      }

      const [reviews, total] = await this.reviewRepo.findAndCount({
        where: { application: { bookId } },
        relations: ['application', 'application.reader', 'application.book'],
        order: { createdAt: 'DESC' },
        skip,
        take,
      });

      return createPaginatedResponse(reviews, total, skip, take);
    }

    const review = await this.reviewRepo.findOne({
      where: {
        application: {
          bookId,
          readerId: userId,
        },
      },
      relations: ['application', 'application.reader', 'application.book'],
    });

    if (!review) {
      return createPaginatedResponse([], 0, skip, take);
    }

    return createPaginatedResponse([review], 1, skip, take);
  }
}
