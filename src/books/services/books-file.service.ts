import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../entity/book.entity';
import { FilesService } from '../../files/files.service';
import { BookErrorCode, BookErrors } from '../errors/book-errors';
import { UserType } from '../../users/enums';
import { ensureAuthor } from '../../common/utils/auth.util';

@Injectable()
export class BooksFileService {
  private readonly logger = new Logger(BooksFileService.name);

  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    private readonly filesService: FilesService,
  ) {}

  async updateFileInfo(
    authorId: string,
    authorUserType: UserType | undefined,
    bookId: string,
    fileUrl: string,
    fileSize: number,
    fileType: string,
  ): Promise<Book> {
    ensureAuthor(authorUserType);

    const book = await this.findOneForAuthor(authorId, bookId);

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
    ensureAuthor(authorUserType);

    const book = await this.findOneForAuthor(authorId, bookId);

    book.coverImageUrl = coverImageUrl;

    await this.bookRepo.save(book);

    return this.findOnePublic(bookId);
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
    if (!file) {
      const error = BookErrors[BookErrorCode.BOOK_FILE_NOT_AVAILABLE];
      throw new BadRequestException({
        message: 'No file provided',
        code: error.code,
      });
    }

    if (!file.buffer) {
      const error = BookErrors[BookErrorCode.BOOK_FILE_NOT_AVAILABLE];
      throw new BadRequestException({
        message:
          'File buffer is missing. Please ensure the file is properly uploaded.',
        code: error.code,
      });
    }

    const book = await this.findOneForAuthor(authorId, bookId);

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
    if (!file) {
      const error = BookErrors[BookErrorCode.BOOK_FILE_NOT_AVAILABLE];
      throw new BadRequestException({
        message: 'No cover image provided',
        code: error.code,
      });
    }

    if (!file.buffer) {
      const error = BookErrors[BookErrorCode.BOOK_FILE_NOT_AVAILABLE];
      throw new BadRequestException({
        message:
          'File buffer is missing. Please ensure the image is properly uploaded.',
        code: error.code,
      });
    }

    const book = await this.findOneForAuthor(authorId, bookId);

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
    ensureAuthor(authorUserType);

    const book = await this.findOneForAuthor(authorId, bookId);

    if (book.coverImageUrl) {
      await this.filesService.deleteFileByUrl(book.coverImageUrl);
    }

    book.coverImageUrl = null;
    await this.bookRepo.save(book);

    return this.findOnePublic(bookId);
  }

  private async findOneForAuthor(
    authorId: string,
    bookId: string,
  ): Promise<Book> {
    const book = await this.bookRepo.findOne({
      where: { id: bookId, authorId },
    });

    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_OWNED_BY_AUTHOR];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    return book;
  }

  private async findOnePublic(bookId: string): Promise<Book> {
    const book = await this.bookRepo.findOne({
      where: { id: bookId },
      relations: ['author', 'series', 'bookGenres', 'bookGenres.genre'],
    });

    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    return book;
  }
}
