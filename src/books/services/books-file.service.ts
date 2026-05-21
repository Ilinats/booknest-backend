import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Book } from '../entity/book.entity';
import { FilesService } from '../../files/files.service';
import { BookErrors } from '../errors/book-errors';
import { UserType } from '../../users/enums';
import { BookPdfFingerprintService } from './book-pdf-fingerprint.service';
import { BookEpubFingerprintService } from './book-epub-fingerprint.service';

@Injectable()
export class BooksFileService {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    private readonly filesService: FilesService,
    private readonly bookPdfFingerprintService: BookPdfFingerprintService,
    private readonly bookEpubFingerprintService: BookEpubFingerprintService,
  ) {}

  async updateFileInfo(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    fileUrl: string,
    fileSize: number,
    fileType: string,
  ): Promise<Book> {
    const book = await this.findOneOrFail(bookId);

    book.fileUrl = fileUrl;
    book.fileSize = fileSize.toString();
    book.fileType = fileType;

    return this.bookRepo.save(book);
  }

  async updateCoverImage(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    coverImageUrl: string,
  ): Promise<Book> {
    const book = await this.findOneOrFail(bookId);

    book.coverImageUrl = coverImageUrl;
    await this.bookRepo.save(book);

    return this.findBookWithRelations(bookId);
  }

  async uploadBookFile(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    file: Express.Multer.File,
  ): Promise<{
    book: Book;
    file: {
      url: string;
      size: number;
      type: string;
      originalName: string;
    };
  }> {
    this.validateFile(file);
    const book = await this.findOneOrFail(bookId);

    if (book.fileUrl) {
      await this.filesService.deleteFileByUrl(book.fileUrl);
    }

    const uploadResult = await this.filesService.uploadFile(file, 'books');
    const updatedBook = await this.updateFileInfo(
      authorId,
      authorUserType,
      bookId,
      uploadResult.fileUrl,
      uploadResult.fileSize,
      uploadResult.fileType,
    );

    return {
      book: updatedBook,
      file: {
        url: uploadResult.fileUrl,
        size: uploadResult.fileSize,
        type: uploadResult.fileType,
        originalName: file.originalname,
      },
    };
  }

  async uploadCoverImage(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    file: Express.Multer.File,
  ): Promise<{
    book: Book;
    coverImage: {
      url: string;
      size: number;
      type: string;
      originalName: string;
    };
  }> {
    this.validateFile(file);
    const book = await this.findOneOrFail(bookId);

    if (book.coverImageUrl) {
      await this.filesService.deleteFileByUrl(book.coverImageUrl);
    }

    const uploadResult = await this.filesService.uploadImage(
      file,
      'book_covers',
    );
    const updatedBook = await this.updateCoverImage(
      authorId,
      authorUserType,
      bookId,
      uploadResult.fileUrl,
    );

    return {
      book: updatedBook,
      coverImage: {
        url: uploadResult.fileUrl,
        size: uploadResult.fileSize,
        type: uploadResult.fileType,
        originalName: file.originalname,
      },
    };
  }

  async removeCoverImage(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
  ): Promise<Book> {
    const book = await this.findOneOrFail(bookId);

    if (book.coverImageUrl) {
      await this.filesService.deleteFileByUrl(book.coverImageUrl);
    }

    book.coverImageUrl = null;
    await this.bookRepo.save(book);

    return this.findBookWithRelations(bookId);
  }

  async decodeLeakFingerprintFromUpload(
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

    await this.findOneOrFail(bookId);

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

  async sendBookDownloadToResponse(
    res: Response,
    book: Book,
    readerId: string,
  ): Promise<void> {
    if (!book.fileUrl) {
      throw new BadRequestException(BookErrors.BOOK_FILE_NOT_AVAILABLE);
    }

    const bookId = book.id;
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
          { bookId, readerId },
        );
        const filename = `${this.sanitizeDownloadBasename(book.title) || 'book'}.pdf`;
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
          { bookId, readerId },
        );
        const filename = `${this.sanitizeDownloadBasename(book.title) || 'book'}.epub`;
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

  private async findOneOrFail(bookId: string): Promise<Book> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });

    if (!book) {
      throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
    }

    return book;
  }

  private async findBookWithRelations(bookId: string): Promise<Book> {
    const book = await this.bookRepo.findOne({
      where: { id: bookId },
      relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
    });

    if (!book) {
      throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
    }

    return book;
  }

  private sanitizeDownloadBasename(title: string): string {
    return title
      .replace(/[^\w\s.-]/g, '_')
      .trim()
      .slice(0, 180);
  }

  private validateFile(file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException(BookErrors.BOOK_FILE_NOT_AVAILABLE);
    }
  }
}
