import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './entity/book.entity';
import { Series } from '../series/entity/series.entity';
import { CreateBookDto, UpdateBookDto } from './dto';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { FilesService } from '../files/files.service';
import { SelectionMethod, BookStatus, DistributionType } from './enums';
import { PaginateQuery, paginate, FilterOperator } from 'nestjs-paginate';
import { BookErrors } from './errors/book-errors';
import { ensureAuthor } from '../common/utils/auth.util';
import { UserType } from '../users/enums';
import { BooksAnalyticsService } from './services/books-analytics.service';
import { BooksFileService } from './services/books-file.service';
import { ApplicationStatus } from '../applications/enums';
import { BooksQueryHelper, BooksUpdateHelper } from './helpers';
import { BookPdfFingerprintService } from './services/book-pdf-fingerprint.service';
import { BookEpubFingerprintService } from './services/book-epub-fingerprint.service';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Series) private readonly seriesRepo: Repository<Series>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    private readonly filesService: FilesService,
    private readonly booksAnalyticsService: BooksAnalyticsService,
    private readonly booksFileService: BooksFileService,
    private readonly booksQueryHelper: BooksQueryHelper,
    private readonly booksUpdateHelper: BooksUpdateHelper,
    private readonly bookPdfFingerprintService: BookPdfFingerprintService,
    private readonly bookEpubFingerprintService: BookEpubFingerprintService,
  ) {}

  async create(
    authorId: string,
    authorUserType: UserType | undefined,
    dto: CreateBookDto,
  ): Promise<Book> {
    await this.ensureSeriesOwnershipIfProvided(authorId, dto.seriesId);
    this.validateCopies(dto.totalCopies ?? 1, dto.availableCopies);
    this.validateDeadlines(dto.applicationDeadline, dto.reviewDeadline);

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
      totalCopies: dto.totalCopies ?? 1,
      availableCopies: dto.availableCopies ?? dto.totalCopies ?? 1,
      applicationDeadline: new Date(dto.applicationDeadline),
      reviewDeadline: dto.reviewDeadline ? new Date(dto.reviewDeadline) : null,
      selectionCriteria: dto.selectionCriteria ?? null,
      selectionMethod: dto.selectionMethod ?? SelectionMethod.AUTHOR_SELECTS,
      seriesId: dto.seriesId ?? null,
      seriesOrder: dto.seriesOrder ?? null,
    });

    const saved = await this.bookRepo.save(book);

    if (dto.genres?.length) {
      await this.booksUpdateHelper.updateGenres(saved.id, dto.genres);
    }

    return (
      (await this.bookRepo.findOne({
        where: { id: saved.id },
        relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
      })) || saved
    );
  }

  private validateCopies(totalCopies: number, availableCopies?: number) {
    const available = availableCopies ?? totalCopies;
    if (available > totalCopies || available < 0) {
      throw new ForbiddenException(BookErrors.BOOK_INVALID_COPIES);
    }
  }

  private validateDeadlines(
    applicationDeadline: string,
    reviewDeadline?: string,
  ) {
    if (reviewDeadline) {
      const appDeadline = new Date(applicationDeadline);
      const revDeadline = new Date(reviewDeadline);
      if (revDeadline <= appDeadline) {
        throw new BadRequestException(BookErrors.BOOK_INVALID_DEADLINE);
      }
    }
  }

  async createWithFile(
    authorId: string,
    authorUserType: UserType | undefined,
    dto: CreateBookDto,
    file: Express.Multer.File | undefined,
  ): Promise<Book> {
    const book = await this.create(authorId, authorUserType, dto);

    const needsFile = dto.distributionType !== DistributionType.PHYSICAL;
    if (needsFile && !file) {
      throw new BadRequestException(BookErrors.BOOK_FILE_NOT_AVAILABLE);
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
      throw new ForbiddenException(BookErrors.BOOK_NOT_OWNED_BY_AUTHOR);
    }
  }

  async findMy(authorId: string, query: PaginateQuery) {
    return paginate(query, this.bookRepo, {
      sortableColumns: ['createdAt', 'title', 'status'],
      searchableColumns: ['title'],
      defaultSortBy: [['createdAt', 'DESC']],
      filterableColumns: {
        status: [FilterOperator.EQ],
      },
      relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
      where: {
        authorId,
      },
      defaultLimit: 20,
      maxLimit: 100,
    });
  }

  async findOnePublic(
    bookId: string,
    userId?: string,
    userType?: UserType,
  ): Promise<Book> {
    const book = await this.bookRepo.findOne({
      where: { id: bookId },
      relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
    });

    if (!book) {
      throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
    }

    const isAuthor =
      userId && userType === UserType.AUTHOR && book.authorId === userId;
    const hasApprovedApplication = await this.checkUserApplicationStatus(
      userId || '',
      bookId,
    );

    if (!isAuthor && !hasApprovedApplication) {
      delete book.fileUrl;
      delete book.fileSize;
      delete book.fileType;
    }

    return book;
  }

  async update(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    dto: UpdateBookDto & Partial<CreateBookDto>,
  ): Promise<Book> {
    ensureAuthor(authorUserType);
    const book = await this.findBookOrThrow(bookId);
    this.ensureOwnership(book, authorId);
    await this.ensureSeriesOwnershipIfProvided(authorId, dto.seriesId);

    await this.booksUpdateHelper.updateBookFields(book, dto);
    await this.booksUpdateHelper.updateCopies(book, dto);
    await this.booksUpdateHelper.updateDeadlines(book, dto);
    this.booksUpdateHelper.validateCopies(book);

    await this.bookRepo.save(book);

    if (dto.genres !== undefined) {
      await this.booksUpdateHelper.updateGenres(bookId, dto.genres);
    }

    return this.findOnePublic(bookId, authorId, authorUserType);
  }

  private async findBookOrThrow(bookId: string): Promise<Book> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
    }
    return book;
  }

  private ensureOwnership(book: Book, authorId: string) {
    if (book.authorId !== authorId) {
      throw new ForbiddenException(BookErrors.BOOK_CANNOT_MODIFY_OTHERS);
    }
  }

  async remove(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
  ) {
    ensureAuthor(authorUserType);
    const book = await this.findBookOrThrow(bookId);
    this.ensureOwnership(book, authorId);

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
    const book = await this.findBookOrThrow(bookId);
    this.ensureOwnership(book, authorId);
    book.status = BookStatus.ACTIVE;
    book.publishedAt = new Date();
    await this.bookRepo.save(book);

    return this.findOnePublic(bookId, authorId, authorUserType);
  }

  async browse(
    paginateQuery: PaginateQuery,
    userId?: string,
    userType?: UserType,
  ) {
    return this.booksQueryHelper.browse(paginateQuery, userId, userType);
  }

  async featured(userId?: string, userType?: UserType): Promise<Book[]> {
    return this.booksQueryHelper.featured(userId, userType);
  }

  async recommendedForUser(
    userId: string,
    query: PaginateQuery,
    userType?: UserType,
  ) {
    return this.booksQueryHelper.recommendedForUser(userId, query, userType);
  }

  async trending(
    opts?: { limit?: number },
    userId?: string,
    userType?: UserType,
  ): Promise<Array<{ book: Book; applicationCount: number }>> {
    return this.booksQueryHelper.trending(opts, userId, userType);
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
      throw new NotFoundException(BookErrors.BOOK_NOT_OWNED_BY_AUTHOR);
    }

    return book;
  }

  async decodeLeakFingerprintFromUpload(
    authorId: string,
    bookId: string,
    file: Express.Multer.File | undefined,
  ): Promise<{
    readerId: string;
    bookId: string;
    issuedAt: number;
    format: 'pdf' | 'epub';
  }> {
    if (!file?.buffer) {
      throw new BadRequestException(BookErrors.BOOK_FILE_NOT_AVAILABLE);
    }
    await this.findOneForAuthor(authorId, bookId);
    const fromPdf = await this.bookPdfFingerprintService.extractFingerprint(
      file.buffer,
    );
    if (fromPdf) {
      if (fromPdf.bookId !== bookId) {
        throw new BadRequestException(BookErrors.BOOK_FINGERPRINT_WRONG_BOOK);
      }
      return {
        readerId: fromPdf.readerId,
        bookId: fromPdf.bookId,
        issuedAt: fromPdf.iat,
        format: 'pdf' as const,
      };
    }
    const fromEpub = await this.bookEpubFingerprintService.extractFingerprint(
      file.buffer,
    );
    if (fromEpub) {
      if (fromEpub.bookId !== bookId) {
        throw new BadRequestException(BookErrors.BOOK_FINGERPRINT_WRONG_BOOK);
      }
      return {
        readerId: fromEpub.readerId,
        bookId: fromEpub.bookId,
        issuedAt: fromEpub.iat,
        format: 'epub' as const,
      };
    }
    throw new NotFoundException(BookErrors.BOOK_FINGERPRINT_NOT_FOUND);
  }

  async checkUserApplicationStatus(
    userId: string,
    bookId: string,
  ): Promise<boolean> {
    if (!userId) return false;

    const application = await this.applicationRepo.findOne({
      where: {
        readerId: userId,
        bookId,
        status: ApplicationStatus.APPROVED,
      },
    });

    return !!application;
  }

  async sendBookDownloadToResponse(
    res: Response,
    userId: string,
    userType: UserType | undefined,
    bookId: string,
  ): Promise<void> {
    const book = await this.findOnePublic(bookId, userId, userType);

    if (!book.fileUrl) {
      throw new BadRequestException(BookErrors.BOOK_FILE_NOT_AVAILABLE);
    }

    const fileKey =
      this.filesService.extractFileKeyFromUrl(book.fileUrl) ||
      book.fileUrl.split('/').slice(-2).join('/');

    if (
      this.bookPdfFingerprintService.isPdfBook(
        book.fileType ?? undefined,
        fileKey,
      )
    ) {
      try {
        const raw = await this.filesService.getObjectBuffer(fileKey);
        const marked = await this.bookPdfFingerprintService.embedFingerprint(
          raw,
          {
            bookId,
            readerId: userId,
          },
        );
        const baseName = this.sanitizeBookDownloadBasename(book.title);
        const filename = `${baseName || 'book'}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        );
        res.setHeader('Content-Length', String(marked.length));
        res.send(marked);
        return;
      } catch {
        throw new BadRequestException(BookErrors.BOOK_PDF_WATERMARK_FAILED);
      }
    }

    if (
      this.bookEpubFingerprintService.isEpubBook(
        book.fileType ?? undefined,
        fileKey,
      )
    ) {
      try {
        const raw = await this.filesService.getObjectBuffer(fileKey);
        const marked = await this.bookEpubFingerprintService.embedFingerprint(
          raw,
          {
            bookId,
            readerId: userId,
          },
        );
        const baseName = this.sanitizeBookDownloadBasename(book.title);
        const filename = `${baseName || 'book'}.epub`;
        res.setHeader('Content-Type', 'application/epub+zip');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        );
        res.setHeader('Content-Length', String(marked.length));
        res.send(marked);
        return;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(BookErrors.BOOK_EPUB_FINGERPRINT_FAILED);
      }
    }

    const downloadUrl = await this.filesService.getFileDownloadUrl(fileKey);
    res.json({
      downloadUrl,
      expiresIn: 3600,
      fileName: book.title,
      fileSize: book.fileSize,
      fileType: book.fileType,
    });
  }

  private sanitizeBookDownloadBasename(title: string): string {
    return title
      .replace(/[^\w\s.-]/g, '_')
      .trim()
      .slice(0, 180);
  }

  async getBookAllReviews(
    userId: string,
    userType: UserType | undefined,
    bookId: string,
    query: PaginateQuery,
  ) {
    if (userType === UserType.AUTHOR) {
      ensureAuthor(userType);
      await this.findOneForAuthor(userId, bookId);
      return this.getAuthorReviews(bookId, query);
    }

    return this.getReaderReview(userId, bookId, query);
  }

  private getAuthorReviews(bookId: string, query: PaginateQuery) {
    const qb = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.application', 'application')
      .leftJoinAndSelect('application.reader', 'reader')
      .leftJoinAndSelect('application.book', 'book')
      .where('application.bookId = :bookId', { bookId });

    return paginate(query, qb, {
      sortableColumns: ['createdAt'],
      defaultSortBy: [['createdAt', 'DESC']],
      defaultLimit: 20,
      maxLimit: 100,
    });
  }

  private async getReaderReview(
    userId: string,
    bookId: string,
    query: PaginateQuery,
  ) {
    const review = await this.reviewRepo.findOne({
      where: {
        application: {
          bookId,
          readerId: userId,
        },
      },
      relations: ['application', 'application.reader', 'application.book'],
    });

    const qb = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.application', 'application')
      .leftJoinAndSelect('application.reader', 'reader')
      .leftJoinAndSelect('application.book', 'book')
      .where(review ? 'review.id = :reviewId' : '1 = 0', {
        reviewId: review?.id,
      });

    return paginate(query, qb, {
      sortableColumns: ['createdAt'],
      defaultSortBy: [['createdAt', 'DESC']],
      defaultLimit: 20,
      maxLimit: 100,
    });
  }
}
