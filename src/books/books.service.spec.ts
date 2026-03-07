import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { BooksService } from './books.service';
import { Book } from './entity/book.entity';
import { Series } from '../series/entity/series.entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { FilesService } from '../files/files.service';
import { BooksAnalyticsService } from './services/books-analytics.service';
import { BooksFileService } from './services/books-file.service';
import { BooksQueryHelper, BooksUpdateHelper } from './helpers';
import { User } from '../users/entity/user.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { UserGenrePreference } from '../user-genre-preferences/entity/user-genre-preference.entity';
import { CreateBookDto } from './dto';
import { BookErrors } from './errors/book-errors';
import { AgeRating, DistributionType, SelectionMethod } from './enums';
import { UserType } from '../users/enums';
import { ApplicationStatus } from '../applications/enums';
import { PaginateQuery } from 'nestjs-paginate';

jest.mock('nestjs-paginate', () => ({
  paginate: jest.fn().mockResolvedValue({ data: [], meta: {}, links: {} }),
  FilterOperator: { EQ: '$eq' },
}));

type MockRepo<T = unknown> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

const baseCreateDto: CreateBookDto = {
  title: 'Test Book',
  ageRating: AgeRating.ALL,
  distributionType: DistributionType.PHYSICAL,
  applicationDeadline: new Date(Date.now() + 86400000).toISOString(),
};

describe('BooksService', () => {
  let service: BooksService;
  let bookRepo: MockRepo<Book>;
  let seriesRepo: MockRepo<Series>;
  let applicationRepo: MockRepo<Application>;
  let reviewRepo: MockRepo<Review>;
  let filesService: { deleteFileByUrl: jest.Mock };
  let booksUpdateHelper: {
    updateBookFields: jest.Mock;
    updateCopies: jest.Mock;
    updateDeadlines: jest.Mock;
    validateCopies: jest.Mock;
    updateGenres: jest.Mock;
  };
  let booksQueryHelper: {
    browse: jest.Mock;
    featured: jest.Mock;
    recommendedForUser: jest.Mock;
    trending: jest.Mock;
  };
  let booksAnalyticsService: {
    stats: jest.Mock;
    analytics: jest.Mock;
    getAuthorAnalytics: jest.Mock;
    getBookPerformanceComparison: jest.Mock;
  };
  let booksFileService: {
    uploadBookFile: jest.Mock;
    uploadCoverImage: jest.Mock;
    updateCoverImage: jest.Mock;
    updateFileInfo: jest.Mock;
    removeCoverImage: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: getRepositoryToken(Book), useValue: createMockRepo() },
        { provide: getRepositoryToken(Series), useValue: createMockRepo() },
        { provide: getRepositoryToken(Application), useValue: createMockRepo() },
        { provide: getRepositoryToken(Review), useValue: createMockRepo() },
        { provide: getRepositoryToken(User), useValue: createMockRepo() },
        { provide: getRepositoryToken(UserAddress), useValue: createMockRepo() },
        {
          provide: getRepositoryToken(UserGenrePreference),
          useValue: createMockRepo(),
        },
        {
          provide: FilesService,
          useValue: { deleteFileByUrl: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: BooksAnalyticsService,
          useValue: {
            stats: jest.fn(),
            analytics: jest.fn(),
            getAuthorAnalytics: jest.fn(),
            getBookPerformanceComparison: jest.fn(),
          },
        },
        {
          provide: BooksFileService,
          useValue: {
            uploadBookFile: jest.fn(),
            uploadCoverImage: jest.fn(),
            updateCoverImage: jest.fn(),
            updateFileInfo: jest.fn(),
            removeCoverImage: jest.fn(),
          },
        },
        {
          provide: BooksQueryHelper,
          useValue: {
            browse: jest.fn(),
            featured: jest.fn(),
            recommendedForUser: jest.fn(),
            trending: jest.fn(),
          },
        },
        {
          provide: BooksUpdateHelper,
          useValue: {
            updateBookFields: jest.fn().mockResolvedValue(undefined),
            updateCopies: jest.fn().mockResolvedValue(undefined),
            updateDeadlines: jest.fn().mockResolvedValue(undefined),
            validateCopies: jest.fn(),
            updateGenres: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
    bookRepo = module.get(getRepositoryToken(Book));
    seriesRepo = module.get(getRepositoryToken(Series));
    applicationRepo = module.get(getRepositoryToken(Application));
    reviewRepo = module.get(getRepositoryToken(Review));
    filesService = module.get(FilesService);
    booksUpdateHelper = module.get(BooksUpdateHelper);
    booksQueryHelper = module.get(BooksQueryHelper);
    booksAnalyticsService = module.get(BooksAnalyticsService);
    booksFileService = module.get(BooksFileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates book and returns it with relations when no genres', async () => {
      seriesRepo.findOne.mockResolvedValue(null);
      const created = { id: 'b1', title: baseCreateDto.title } as Book;
      bookRepo.create.mockReturnValue(created);
      bookRepo.save.mockResolvedValue(created);
      const withRelations = { ...created, author: {}, series: null } as Book;
      bookRepo.findOne.mockResolvedValue(withRelations);

      const result = await service.create('author-1', UserType.AUTHOR, baseCreateDto);

      expect(bookRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: 'author-1',
          title: baseCreateDto.title,
          distributionType: baseCreateDto.distributionType,
        }),
      );
      expect(booksUpdateHelper.updateGenres).not.toHaveBeenCalled();
      expect(result).toEqual(withRelations);
    });

    it('calls updateGenres when genres provided', async () => {
      seriesRepo.findOne.mockResolvedValue(null);
      const saved = { id: 'b1' } as Book;
      bookRepo.create.mockReturnValue(saved);
      bookRepo.save.mockResolvedValue(saved);
      bookRepo.findOne.mockResolvedValue(saved);

      await service.create('author-1', UserType.AUTHOR, {
        ...baseCreateDto,
        genres: [1, 2],
      });

      expect(booksUpdateHelper.updateGenres).toHaveBeenCalledWith('b1', [1, 2]);
    });

    it('throws when copies are invalid (available > total)', async () => {
      seriesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('author-1', UserType.AUTHOR, {
          ...baseCreateDto,
          totalCopies: 5,
          availableCopies: 10,
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.create('author-1', UserType.AUTHOR, {
          ...baseCreateDto,
          totalCopies: 5,
          availableCopies: 10,
        }),
      ).rejects.toThrow(BookErrors.BOOK_INVALID_COPIES);
    });

    it('throws when review deadline is before application deadline', async () => {
      const appDeadline = new Date(Date.now() + 86400000);
      const revDeadline = new Date(Date.now() + 43200000);
      seriesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('author-1', UserType.AUTHOR, {
          ...baseCreateDto,
          applicationDeadline: appDeadline.toISOString(),
          reviewDeadline: revDeadline.toISOString(),
        }),
      ).rejects.toThrow(BookErrors.BOOK_INVALID_DEADLINE);
    });

    it('throws when series exists but belongs to another author', async () => {
      seriesRepo.findOne.mockResolvedValue({
        id: 's1',
        authorId: 'other-author',
      });

      await expect(
        service.create('author-1', UserType.AUTHOR, {
          ...baseCreateDto,
          seriesId: 's1',
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.create('author-1', UserType.AUTHOR, {
          ...baseCreateDto,
          seriesId: 's1',
        }),
      ).rejects.toThrow(BookErrors.BOOK_NOT_OWNED_BY_AUTHOR);
    });

    it('does not check series when seriesId not provided', async () => {
      const saved = { id: 'b1' } as Book;
      bookRepo.create.mockReturnValue(saved);
      bookRepo.save.mockResolvedValue(saved);
      bookRepo.findOne.mockResolvedValue(saved);

      await service.create('author-1', UserType.AUTHOR, baseCreateDto);

      expect(seriesRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('createWithFile', () => {
    it('throws when distribution needs file but file is missing', async () => {
      seriesRepo.findOne.mockResolvedValue(null);
      const saved = { id: 'b1' } as Book;
      bookRepo.create.mockReturnValue(saved);
      bookRepo.save.mockResolvedValue(saved);
      bookRepo.findOne.mockResolvedValue(saved);

      await expect(
        service.createWithFile('author-1', UserType.AUTHOR, {
          ...baseCreateDto,
          distributionType: DistributionType.DIGITAL,
        }, undefined),
      ).rejects.toThrow(BookErrors.BOOK_FILE_NOT_AVAILABLE);
    });

    it('returns book when distribution is physical and no file', async () => {
      seriesRepo.findOne.mockResolvedValue(null);
      const saved = { id: 'b1', title: 'T' } as Book;
      bookRepo.create.mockReturnValue(saved);
      bookRepo.save.mockResolvedValue(saved);
      bookRepo.findOne.mockResolvedValue(saved);

      const result = await service.createWithFile(
        'author-1',
        UserType.AUTHOR,
        { ...baseCreateDto, distributionType: DistributionType.PHYSICAL },
        undefined,
      );

      expect(result).toEqual(saved);
      expect(booksFileService.uploadBookFile).not.toHaveBeenCalled();
    });

    it('uploads file and returns result when file provided', async () => {
      seriesRepo.findOne.mockResolvedValue(null);
      const saved = { id: 'b1' } as Book;
      bookRepo.create.mockReturnValue(saved);
      bookRepo.save.mockResolvedValue(saved);
      bookRepo.findOne.mockResolvedValue(saved);
      const file = { buffer: Buffer.from('x') } as Express.Multer.File;
      const uploadedBook = { id: 'b1', fileUrl: 'https://x/file' } as Book;
      booksFileService.uploadBookFile.mockResolvedValue({ book: uploadedBook });

      const result = await service.createWithFile(
        'author-1',
        UserType.AUTHOR,
        baseCreateDto,
        file,
      );

      expect(booksFileService.uploadBookFile).toHaveBeenCalledWith(
        'author-1',
        UserType.AUTHOR,
        'b1',
        file,
      );
      expect(result).toEqual(uploadedBook);
    });
  });

  describe('findOnePublic', () => {
    it('throws when book not found', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(service.findOnePublic('book-1')).rejects.toThrow(BookErrors.BOOK_NOT_FOUND);
    });

    it('keeps fileUrl when user is author', async () => {
      const book = {
        id: 'b1',
        authorId: 'author-1',
        fileUrl: 'https://file',
        fileSize: 100,
        fileType: 'pdf',
      } as unknown as Book;
      bookRepo.findOne.mockResolvedValue({ ...book });

      const result = await service.findOnePublic(
        'b1',
        'author-1',
        UserType.AUTHOR,
      );

      expect(result.fileUrl).toBe('https://file');
    });

    it('strips file fields when not author and no approved application', async () => {
      const book = {
        id: 'b1',
        authorId: 'author-1',
        fileUrl: 'https://file',
        fileSize: 100,
        fileType: 'pdf',
      } as unknown as Book;
      bookRepo.findOne.mockResolvedValue({ ...book });
      applicationRepo.findOne.mockResolvedValue(null);

      const result = await service.findOnePublic('b1', 'reader-1', UserType.READER);

      expect(result.fileUrl).toBeUndefined();
      expect(result.fileSize).toBeUndefined();
      expect(result.fileType).toBeUndefined();
    });

    it('keeps file fields when user has approved application', async () => {
      const book = {
        id: 'b1',
        authorId: 'author-1',
        fileUrl: 'https://file',
      } as Book;
      bookRepo.findOne.mockResolvedValue({ ...book });
      applicationRepo.findOne.mockResolvedValue({ id: 'app1', status: ApplicationStatus.APPROVED });

      const result = await service.findOnePublic('b1', 'reader-1', UserType.READER);

      expect(result.fileUrl).toBe('https://file');
    });
  });

  describe('update', () => {
    it('throws when user is not author', async () => {
      await expect(
        service.update('user-1', UserType.READER, 'book-1', {} as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when book not found', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'book-1', {} as any),
      ).rejects.toThrow(BookErrors.BOOK_NOT_FOUND);
    });

    it('throws when book belongs to another author', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'other-author',
      } as Book);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'book-1', {} as any),
      ).rejects.toThrow(BookErrors.BOOK_CANNOT_MODIFY_OTHERS);
    });

    it('calls update helpers and returns findOnePublic result', async () => {
      const book = { id: 'book-1', authorId: 'author-1' } as Book;
      bookRepo.findOne
        .mockResolvedValueOnce(book)
        .mockResolvedValueOnce({ ...book, title: 'Updated' });
      applicationRepo.findOne.mockResolvedValue(null);

      const result = await service.update(
        'author-1',
        UserType.AUTHOR,
        'book-1',
        { title: 'Updated' } as any,
      );

      expect(booksUpdateHelper.updateBookFields).toHaveBeenCalledWith(book, expect.any(Object));
      expect(booksUpdateHelper.updateCopies).toHaveBeenCalled();
      expect(booksUpdateHelper.updateDeadlines).toHaveBeenCalled();
      expect(booksUpdateHelper.validateCopies).toHaveBeenCalledWith(book);
      expect(bookRepo.save).toHaveBeenCalledWith(book);
      expect(result.title).toBe('Updated');
    });

    it('calls updateGenres when dto.genres is defined', async () => {
      const book = { id: 'book-1', authorId: 'author-1' } as Book;
      bookRepo.findOne
        .mockResolvedValueOnce(book)
        .mockResolvedValueOnce(book);
      applicationRepo.findOne.mockResolvedValue(null);

      await service.update('author-1', UserType.AUTHOR, 'book-1', {
        genres: [1, 2],
      } as any);

      expect(booksUpdateHelper.updateGenres).toHaveBeenCalledWith('book-1', [1, 2]);
    });
  });

  describe('remove', () => {
    it('throws when user is not author', async () => {
      await expect(
        service.remove('user-1', UserType.READER, 'book-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deletes file and cover when present, then deletes book', async () => {
      const book = {
        id: 'book-1',
        authorId: 'author-1',
        fileUrl: 'https://file',
        coverImageUrl: 'https://cover',
      } as Book;
      bookRepo.findOne.mockResolvedValue(book);
      bookRepo.delete.mockResolvedValue({});

      await service.remove('author-1', UserType.AUTHOR, 'book-1');

      expect(filesService.deleteFileByUrl).toHaveBeenCalledWith('https://file');
      expect(filesService.deleteFileByUrl).toHaveBeenCalledWith('https://cover');
      expect(bookRepo.delete).toHaveBeenCalledWith('book-1');
    });

    it('deletes book without calling deleteFile when no file or cover', async () => {
      const book = { id: 'book-1', authorId: 'author-1' } as Book;
      bookRepo.findOne.mockResolvedValue(book);
      bookRepo.delete.mockResolvedValue({});

      await service.remove('author-1', UserType.AUTHOR, 'book-1');

      expect(filesService.deleteFileByUrl).not.toHaveBeenCalled();
      expect(bookRepo.delete).toHaveBeenCalledWith('book-1');
    });
  });

  describe('publish', () => {
    it('throws when user is not author', async () => {
      await expect(
        service.publish('user-1', UserType.READER, 'book-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sets status ACTIVE and publishedAt then returns findOnePublic', async () => {
      const book = { id: 'book-1', authorId: 'author-1', status: 'draft' } as Book;
      bookRepo.findOne
        .mockResolvedValueOnce(book)
        .mockResolvedValueOnce({ ...book, status: 'active' });
      bookRepo.save.mockResolvedValue(book);
      applicationRepo.findOne.mockResolvedValue(null);

      const result = await service.publish('author-1', UserType.AUTHOR, 'book-1');

      expect(book.status).toBe('active');
      expect(book.publishedAt).toBeDefined();
      expect(bookRepo.save).toHaveBeenCalledWith(book);
      expect(result).toBeDefined();
    });
  });

  describe('findMy', () => {
    it('returns paginated result for author', async () => {
      const { paginate } = require('nestjs-paginate');
      (paginate as jest.Mock).mockResolvedValue({
        data: [{ id: 'b1' }],
        meta: { totalItems: 1 },
        links: {},
      });

      const result = await service.findMy('author-1', {} as PaginateQuery);

      expect(paginate).toHaveBeenCalledWith(
        expect.anything(),
        bookRepo,
        expect.objectContaining({
          where: { authorId: 'author-1' },
          sortableColumns: ['createdAt', 'title', 'status'],
        }),
      );
      expect(result.data).toHaveLength(1);
    });
  });

  describe('browse', () => {
    it('delegates to booksQueryHelper.browse', async () => {
      booksQueryHelper.browse.mockResolvedValue({ data: [] });

      await service.browse({} as PaginateQuery, 'user-1', UserType.READER);

      expect(booksQueryHelper.browse).toHaveBeenCalledWith(
        {},
        'user-1',
        UserType.READER,
      );
    });
  });

  describe('featured', () => {
    it('delegates to booksQueryHelper.featured', async () => {
      booksQueryHelper.featured.mockResolvedValue([]);

      const result = await service.featured('user-1', UserType.READER);

      expect(booksQueryHelper.featured).toHaveBeenCalledWith('user-1', UserType.READER);
      expect(result).toEqual([]);
    });
  });

  describe('recommendedForUser', () => {
    it('delegates to booksQueryHelper.recommendedForUser', async () => {
      booksQueryHelper.recommendedForUser.mockResolvedValue({ data: [] });

      await service.recommendedForUser('user-1', {} as PaginateQuery, UserType.READER);

      expect(booksQueryHelper.recommendedForUser).toHaveBeenCalledWith(
        'user-1',
        {},
        UserType.READER,
      );
    });
  });

  describe('trending', () => {
    it('delegates to booksQueryHelper.trending', async () => {
      booksQueryHelper.trending.mockResolvedValue([]);

      const result = await service.trending({ limit: 10 }, 'user-1', UserType.READER);

      expect(booksQueryHelper.trending).toHaveBeenCalledWith(
        { limit: 10 },
        'user-1',
        UserType.READER,
      );
      expect(result).toEqual([]);
    });
  });

  describe('stats', () => {
    it('delegates to booksAnalyticsService.stats', async () => {
      booksAnalyticsService.stats.mockResolvedValue({ views: 0 });

      await service.stats('author-1', 'book-1');

      expect(booksAnalyticsService.stats).toHaveBeenCalledWith('author-1', 'book-1');
    });
  });

  describe('analytics', () => {
    it('delegates to booksAnalyticsService.analytics', async () => {
      booksAnalyticsService.analytics.mockResolvedValue({});

      await service.analytics('author-1', 'book-1');

      expect(booksAnalyticsService.analytics).toHaveBeenCalledWith('author-1', 'book-1');
    });
  });

  describe('getAuthorAnalytics', () => {
    it('delegates to booksAnalyticsService.getAuthorAnalytics', async () => {
      booksAnalyticsService.getAuthorAnalytics.mockResolvedValue({});

      await service.getAuthorAnalytics('author-1', '7d');

      expect(booksAnalyticsService.getAuthorAnalytics).toHaveBeenCalledWith(
        'author-1',
        '7d',
      );
    });
  });

  describe('getBookPerformanceComparison', () => {
    it('delegates to booksAnalyticsService.getBookPerformanceComparison', async () => {
      booksAnalyticsService.getBookPerformanceComparison.mockResolvedValue([]);

      await service.getBookPerformanceComparison('author-1');

      expect(booksAnalyticsService.getBookPerformanceComparison).toHaveBeenCalledWith('author-1');
    });
  });

  describe('updateFileInfo', () => {
    it('delegates to booksFileService.updateFileInfo', async () => {
      const book = { id: 'b1' } as Book;
      booksFileService.updateFileInfo.mockResolvedValue(book);

      const result = await service.updateFileInfo(
        'author-1',
        UserType.AUTHOR,
        'book-1',
        'https://url',
        100,
        'pdf',
      );

      expect(booksFileService.updateFileInfo).toHaveBeenCalledWith(
        'author-1',
        UserType.AUTHOR,
        'book-1',
        'https://url',
        100,
        'pdf',
      );
      expect(result).toBe(book);
    });
  });

  describe('updateCoverImage', () => {
    it('delegates to booksFileService.updateCoverImage', async () => {
      booksFileService.updateCoverImage.mockResolvedValue({} as Book);

      await service.updateCoverImage(
        'author-1',
        UserType.AUTHOR,
        'book-1',
        'https://cover',
      );

      expect(booksFileService.updateCoverImage).toHaveBeenCalledWith(
        'author-1',
        UserType.AUTHOR,
        'book-1',
        'https://cover',
      );
    });
  });

  describe('uploadBookFile', () => {
    it('delegates to booksFileService.uploadBookFile', async () => {
      const file = {} as Express.Multer.File;
      booksFileService.uploadBookFile.mockResolvedValue({ book: {} as Book });

      await service.uploadBookFile('author-1', UserType.AUTHOR, 'book-1', file);

      expect(booksFileService.uploadBookFile).toHaveBeenCalledWith(
        'author-1',
        UserType.AUTHOR,
        'book-1',
        file,
      );
    });
  });

  describe('uploadCoverImage', () => {
    it('delegates to booksFileService.uploadCoverImage', async () => {
      const file = {} as Express.Multer.File;
      booksFileService.uploadCoverImage.mockResolvedValue({} as Book);

      await service.uploadCoverImage('author-1', UserType.AUTHOR, 'book-1', file);

      expect(booksFileService.uploadCoverImage).toHaveBeenCalledWith(
        'author-1',
        UserType.AUTHOR,
        'book-1',
        file,
      );
    });
  });

  describe('removeCoverImage', () => {
    it('delegates to booksFileService.removeCoverImage', async () => {
      await service.removeCoverImage('author-1', UserType.AUTHOR, 'book-1');

      expect(booksFileService.removeCoverImage).toHaveBeenCalledWith(
        'author-1',
        UserType.AUTHOR,
        'book-1',
      );
    });
  });

  describe('findOneForAuthor', () => {
    it('throws when book not found or not owned by author', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOneForAuthor('author-1', 'book-1'),
      ).rejects.toThrow(BookErrors.BOOK_NOT_OWNED_BY_AUTHOR);
    });

    it('returns book when found for author', async () => {
      const book = { id: 'book-1', authorId: 'author-1' } as Book;
      bookRepo.findOne.mockResolvedValue(book);

      const result = await service.findOneForAuthor('author-1', 'book-1');

      expect(bookRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'book-1', authorId: 'author-1' },
      });
      expect(result).toEqual(book);
    });
  });

  describe('checkUserApplicationStatus', () => {
    it('returns false when userId is empty', async () => {
      const result = await service.checkUserApplicationStatus('', 'book-1');

      expect(result).toBe(false);
      expect(applicationRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns false when no approved application', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      const result = await service.checkUserApplicationStatus('reader-1', 'book-1');

      expect(result).toBe(false);
    });

    it('returns true when approved application exists', async () => {
      applicationRepo.findOne.mockResolvedValue({
        id: 'app1',
        status: ApplicationStatus.APPROVED,
      });

      const result = await service.checkUserApplicationStatus('reader-1', 'book-1');

      expect(result).toBe(true);
    });
  });

  describe('getBookAllReviews', () => {
    it('when author: ensures author and uses findOneForAuthor + getAuthorReviews', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
      };
      reviewRepo.createQueryBuilder.mockReturnValue(qb);
      const { paginate } = require('nestjs-paginate');
      (paginate as jest.Mock).mockResolvedValue({ data: [], meta: {}, links: {} });

      bookRepo.findOne.mockResolvedValue({ id: 'book-1', authorId: 'author-1' } as Book);

      const result = await service.getBookAllReviews(
        'author-1',
        UserType.AUTHOR,
        'book-1',
        {} as PaginateQuery,
      );

      expect(reviewRepo.createQueryBuilder).toHaveBeenCalledWith('review');
      expect(result).toEqual({ data: [], meta: {}, links: {} });
    });

    it('when reader: uses getReaderReview', async () => {
      reviewRepo.findOne.mockResolvedValue(null);
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
      };
      reviewRepo.createQueryBuilder.mockReturnValue(qb);
      const { paginate } = require('nestjs-paginate');
      (paginate as jest.Mock).mockResolvedValue({ data: [], meta: {}, links: {} });

      const result = await service.getBookAllReviews(
        'reader-1',
        UserType.READER,
        'book-1',
        {} as PaginateQuery,
      );

      expect(reviewRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            application: { bookId: 'book-1', readerId: 'reader-1' },
          },
        }),
      );
      expect(result).toEqual({ data: [], meta: {}, links: {} });
    });
  });
});

