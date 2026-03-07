import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BooksUpdateHelper } from './books-update.helper';
import { Book } from '../entity/book.entity';
import { BookGenre } from '../entity/book-genre.entity';
import { Application } from '../../applications/entity/application.entity';
import { Genre } from '../../genres/entity/genre.entity';
import { BookStatus } from '../enums';
import { BookErrors } from '../errors/book-errors';

type MockRepo = { find: jest.Mock; count: jest.Mock; delete: jest.Mock; create: jest.Mock; save: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn().mockResolvedValue({}),
    create: jest.fn(),
    save: jest.fn().mockResolvedValue([]),
  };
}

describe('BooksUpdateHelper', () => {
  let helper: BooksUpdateHelper;
  let bookRepo: MockRepo;
  let bookGenreRepo: MockRepo;
  let applicationRepo: MockRepo;
  let genreRepo: MockRepo;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksUpdateHelper,
        { provide: getRepositoryToken(Book), useValue: createMockRepo() },
        { provide: getRepositoryToken(BookGenre), useValue: createMockRepo() },
        { provide: getRepositoryToken(Application), useValue: createMockRepo() },
        { provide: getRepositoryToken(Genre), useValue: createMockRepo() },
      ],
    }).compile();

    helper = module.get<BooksUpdateHelper>(BooksUpdateHelper);
    bookRepo = module.get(getRepositoryToken(Book));
    bookGenreRepo = module.get(getRepositoryToken(BookGenre));
    applicationRepo = module.get(getRepositoryToken(Application));
    genreRepo = module.get(getRepositoryToken(Genre));
  });

  describe('updateBookFields', () => {
    it('updates only provided fields', async () => {
      const book = {
        id: 'b1',
        title: 'Old',
        shortDescription: 'Short',
        pageCount: 10,
      } as unknown as Book;

      await helper.updateBookFields(book, {
        title: 'New Title',
        pageCount: 20,
      } as any);

      expect(book.title).toBe('New Title');
      expect(book.shortDescription).toBe('Short');
      expect(book.pageCount).toBe(20);
    });

    it('updates optional fields when provided', async () => {
      const book = {
        id: 'b1',
        seriesId: null as string | null,
        seriesOrder: null as number | null,
        selectionCriteria: null as string | null,
        selectionMethod: 'author_selects',
      } as unknown as Book;

      await helper.updateBookFields(book, {
        seriesId: 's1',
        seriesOrder: 1,
        selectionCriteria: 'criteria',
        selectionMethod: 'random' as any,
      } as any);

      expect(book.seriesId).toBe('s1');
      expect(book.seriesOrder).toBe(1);
      expect(book.selectionCriteria).toBe('criteria');
      expect(book.selectionMethod).toBe('random');
    });
  });

  describe('updateCopies', () => {
    it('throws when totalCopies is less than approved count', async () => {
      const book = { id: 'b1', totalCopies: 10, availableCopies: 5 } as Book;
      applicationRepo.count.mockResolvedValue(7);

      await expect(
        helper.updateCopies(book, { totalCopies: 5 } as any),
      ).rejects.toThrow(BadRequestException);
      expect(book.totalCopies).toBe(10);
    });

    it('sets totalCopies and availableCopies when totalCopies updated', async () => {
      const book = { id: 'b1', totalCopies: 10, availableCopies: 5 } as Book;
      applicationRepo.count.mockResolvedValue(3);

      await helper.updateCopies(book, { totalCopies: 10 } as any);

      expect(book.totalCopies).toBe(10);
      expect(book.availableCopies).toBe(7);
    });

    it('throws when availableCopies exceeds max available', async () => {
      const book = { id: 'b1', totalCopies: 10, availableCopies: 5 } as Book;
      applicationRepo.count.mockResolvedValue(4);

      await expect(
        helper.updateCopies(book, { availableCopies: 10 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates availableCopies when within limit', async () => {
      const book = { id: 'b1', totalCopies: 10, availableCopies: 5 } as Book;
      applicationRepo.count.mockResolvedValue(4);

      await helper.updateCopies(book, { availableCopies: 2 } as any);

      expect(book.availableCopies).toBe(2);
    });
  });

  describe('updateDeadlines', () => {
    it('sets applicationDeadline and upgrades IN_PROGRESS to ACTIVE when new deadline in future', async () => {
      const book = {
        id: 'b1',
        status: BookStatus.IN_PROGRESS,
        applicationDeadline: new Date('2020-01-01'),
        reviewDeadline: null,
      } as Book;

      await helper.updateDeadlines(book, {
        applicationDeadline: new Date(Date.now() + 86400000).toISOString(),
      } as any);

      expect(book.status).toBe(BookStatus.ACTIVE);
      expect(book.applicationDeadline).toBeDefined();
    });

    it('sets reviewDeadline and downgrades COMPLETED to IN_PROGRESS when new review deadline in future', async () => {
      const applicationDeadline = new Date(Date.now() + 5 * 86400000);
      const book = {
        id: 'b1',
        status: BookStatus.COMPLETED,
        applicationDeadline,
        reviewDeadline: new Date(Date.now() + 43200000),
      } as Book;

      await helper.updateDeadlines(book, {
        reviewDeadline: new Date(Date.now() + 10 * 86400000).toISOString(),
      } as any);

      expect(book.status).toBe(BookStatus.IN_PROGRESS);
      expect(book.reviewDeadline!.getTime()).toBeGreaterThan(applicationDeadline.getTime());
    });

    it('throws when reviewDeadline <= applicationDeadline', async () => {
      const appDeadline = new Date(Date.now() + 86400000);
      const book = {
        id: 'b1',
        applicationDeadline: appDeadline,
        reviewDeadline: new Date(Date.now() + 43200000),
      } as Book;

      await expect(
        helper.updateDeadlines(book, {
          reviewDeadline: new Date(Date.now() - 86400000).toISOString(),
        } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        helper.updateDeadlines(book, {
          reviewDeadline: new Date(Date.now() - 86400000).toISOString(),
        } as any),
      ).rejects.toThrow(BookErrors.BOOK_INVALID_DEADLINE);
    });

    it('accepts null reviewDeadline', async () => {
      const book = {
        id: 'b1',
        applicationDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 43200000),
      } as Book;

      await helper.updateDeadlines(book, { reviewDeadline: null } as any);

      expect(book.reviewDeadline).toBeNull();
    });
  });

  describe('updateGenres', () => {
    it('deletes existing book genres and does nothing when genres empty', async () => {
      await helper.updateGenres('book-1', undefined);

      expect(bookGenreRepo.delete).toHaveBeenCalledWith({ bookId: 'book-1' });
      expect(genreRepo.find).not.toHaveBeenCalled();
    });

    it('deletes and saves new book genres when genres provided', async () => {
      genreRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }] as Genre[]);
      bookGenreRepo.create.mockImplementation((dto: any) => dto);

      await helper.updateGenres('book-1', [1, 2]);

      expect(bookGenreRepo.delete).toHaveBeenCalledWith({ bookId: 'book-1' });
      expect(genreRepo.find).toHaveBeenCalledWith({ where: { id: expect.anything() } });
      expect(bookGenreRepo.create).toHaveBeenCalledWith({ bookId: 'book-1', genreId: 1 });
      expect(bookGenreRepo.create).toHaveBeenCalledWith({ bookId: 'book-1', genreId: 2 });
      expect(bookGenreRepo.save).toHaveBeenCalled();
    });

    it('throws when some genre ids are invalid', async () => {
      genreRepo.find.mockResolvedValue([{ id: 1 }] as Genre[]);

      await expect(helper.updateGenres('book-1', [1, 2, 999])).rejects.toThrow(
        BadRequestException,
      );
      await expect(helper.updateGenres('book-1', [1, 2, 999])).rejects.toThrow(
        BookErrors.BOOK_INVALID_GENRE_IDS,
      );
    });
  });

  describe('validateCopies', () => {
    it('does not throw when copies valid', () => {
      const book = { availableCopies: 5, totalCopies: 10 } as Book;
      expect(() => helper.validateCopies(book)).not.toThrow();
    });

    it('throws when availableCopies > totalCopies', () => {
      const book = { availableCopies: 15, totalCopies: 10 } as Book;
      expect(() => helper.validateCopies(book)).toThrow(ForbiddenException);
      expect(() => helper.validateCopies(book)).toThrow(BookErrors.BOOK_INVALID_COPIES);
    });

    it('throws when availableCopies < 0', () => {
      const book = { availableCopies: -1, totalCopies: 10 } as Book;
      expect(() => helper.validateCopies(book)).toThrow(ForbiddenException);
    });
  });
});
