import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Book } from '../entity/book.entity';
import { BookGenre } from '../entity/book-genre.entity';
import { Application } from '../../applications/entity/application.entity';
import { Genre } from '../../genres/entity/genre.entity';
import { BookStatus } from '../enums';
import { ApplicationStatus } from '../../applications/enums';
import { BookErrors } from '../errors/book-errors';
import { CreateBookDto, UpdateBookDto } from '../dto';

@Injectable()
export class BooksUpdateHelper {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(BookGenre)
    private readonly bookGenreRepo: Repository<BookGenre>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Genre) private readonly genreRepo: Repository<Genre>,
  ) {}

  async updateBookFields(
    book: Book,
    dto: UpdateBookDto & Partial<CreateBookDto>,
  ) {
    if (dto.title !== undefined) book.title = dto.title;
    if (dto.shortDescription !== undefined)
      book.shortDescription = dto.shortDescription;
    if (dto.fullDescription !== undefined)
      book.fullDescription = dto.fullDescription;
    if (dto.pageCount !== undefined) book.pageCount = dto.pageCount;
    if (dto.ageRating !== undefined) book.ageRating = dto.ageRating;
    if (dto.distributionType !== undefined)
      book.distributionType = dto.distributionType;
    if (dto.selectionCriteria !== undefined)
      book.selectionCriteria = dto.selectionCriteria;
    if (dto.selectionMethod !== undefined)
      book.selectionMethod = dto.selectionMethod;
    if (dto.seriesId !== undefined) book.seriesId = dto.seriesId;
    if (dto.seriesOrder !== undefined) book.seriesOrder = dto.seriesOrder;
  }

  async updateCopies(book: Book, dto: UpdateBookDto & Partial<CreateBookDto>) {
    if (dto.totalCopies !== undefined) {
      const approvedCount = await this.getApprovedApplicationsCount(book.id);

      if (dto.totalCopies < approvedCount) {
        throw new BadRequestException(
          `Total copies (${dto.totalCopies}) cannot be less than approved applications (${approvedCount})`,
        );
      }

      book.totalCopies = dto.totalCopies;
      book.availableCopies = dto.totalCopies - approvedCount;
    } else if (dto.availableCopies !== undefined) {
      const approvedCount = await this.getApprovedApplicationsCount(book.id);
      const maxAvailable = book.totalCopies - approvedCount;

      if (dto.availableCopies > maxAvailable) {
        throw new BadRequestException(
          `Available copies (${dto.availableCopies}) cannot exceed ${maxAvailable} (total: ${book.totalCopies}, approved: ${approvedCount})`,
        );
      }

      book.availableCopies = dto.availableCopies;
    }
  }

  async updateDeadlines(
    book: Book,
    dto: UpdateBookDto & Partial<CreateBookDto>,
  ) {
    if (dto.applicationDeadline !== undefined) {
      const newDeadline = new Date(dto.applicationDeadline);

      if (book.status === BookStatus.IN_PROGRESS && newDeadline > new Date()) {
        book.status = BookStatus.ACTIVE;
      }

      book.applicationDeadline = newDeadline;
    }

    if (dto.reviewDeadline !== undefined) {
      const newReviewDeadline = dto.reviewDeadline
        ? new Date(dto.reviewDeadline)
        : null;

      if (
        book.status === BookStatus.COMPLETED &&
        newReviewDeadline &&
        newReviewDeadline > new Date()
      ) {
        book.status = BookStatus.IN_PROGRESS;
      }

      book.reviewDeadline = newReviewDeadline;
    }

    if (
      book.reviewDeadline &&
      book.reviewDeadline <= book.applicationDeadline
    ) {
      throw new BadRequestException(BookErrors.BOOK_INVALID_DEADLINE);
    }
  }

  async updateGenres(bookId: string, genres?: number[]) {
    await this.bookGenreRepo.delete({ bookId });

    if (genres && genres.length > 0) {
      const foundGenres = await this.genreRepo.find({
        where: { id: In(genres) },
      });

      if (foundGenres.length !== genres.length) {
        const foundIds = foundGenres.map((g) => g.id);
        const missing = genres.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(
          `${BookErrors.BOOK_INVALID_GENRE_IDS}: ${missing.join(', ')}`,
        );
      }

      const bookGenres = genres.map((genreId) =>
        this.bookGenreRepo.create({ bookId, genreId }),
      );
      await this.bookGenreRepo.save(bookGenres);
    }
  }

  validateCopies(book: Book) {
    if (book.availableCopies > book.totalCopies || book.availableCopies < 0) {
      throw new ForbiddenException(BookErrors.BOOK_INVALID_COPIES);
    }
  }

  private async getApprovedApplicationsCount(bookId: string): Promise<number> {
    return this.applicationRepo.count({
      where: {
        bookId,
        status: ApplicationStatus.APPROVED,
      },
    });
  }
}
