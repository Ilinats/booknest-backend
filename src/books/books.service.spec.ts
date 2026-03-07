import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BooksService } from './books.service';
import { Book } from './entity/book.entity';
import { Series } from '../series/entity/series.entity';
import { BookGenre } from './entity/book-genre.entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { User } from '../users/entity/user.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { UserGenrePreference } from '../user-genre-preferences/entity/user-genre-preference.entity';
import { Genre } from '../genres/entity/genre.entity';
import { FilesService } from '../files/files.service';
import { BooksQueryService } from './services/books-query.service';
import { BooksAnalyticsService } from './services/books-analytics.service';
import { BooksFileService } from './services/books-file.service';
import { CreateBookDto } from './dto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookErrorCode, BookErrors } from './errors/book-errors';
import { UserType } from '../users/enums';
import { ApplicationStatus } from '../applications/enums';
import { DistributionType } from './enums';
import { BookStatus } from './enums';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('BooksService', () => {
  let service: BooksService;
  let bookRepo: MockRepo<Book>;
  let seriesRepo: MockRepo<Series>;
  let genreRepo: MockRepo<Genre>;
  let bookGenreRepo: MockRepo<BookGenre>;
  let filesService: { deleteFileByUrl: jest.Mock };
  let applicationRepo: MockRepo<Application>;
  let reviewRepo: MockRepo<Review>;
  let booksQueryService: jest.Mocked<BooksQueryService>;
  let booksAnalyticsService: jest.Mocked<BooksAnalyticsService>;
  let booksFileService: jest.Mocked<BooksFileService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        {
          provide: getRepositoryToken(Book),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(Series),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(BookGenre),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(Application),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(Review),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(UserAddress),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(UserGenrePreference),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(Genre),
          useValue: createMockRepo(),
        },
        {
          provide: FilesService,
          useValue: {
            deleteFileByUrl: jest.fn(),
          },
        },
        {
          provide: BooksQueryService,
          useValue: {
            browse: jest.fn(),
            featured: jest.fn(),
            recommendedForUser: jest.fn(),
            trending: jest.fn(),
          },
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
            updateFileInfo: jest.fn(),
            updateCoverImage: jest.fn(),
            removeCoverImage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
    bookRepo = module.get(getRepositoryToken(Book));
    seriesRepo = module.get(getRepositoryToken(Series));
    genreRepo = module.get(getRepositoryToken(Genre));
    bookGenreRepo = module.get(getRepositoryToken(BookGenre));
    filesService = module.get(FilesService);
    applicationRepo = module.get(getRepositoryToken(Application));
    reviewRepo = module.get(getRepositoryToken(Review));
    booksQueryService = module.get(BooksQueryService);
    booksAnalyticsService = module.get(BooksAnalyticsService);
    booksFileService = module.get(BooksFileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ensureSeriesOwnershipIfProvided', () => {
    it('should do nothing if no seriesId is provided', async () => {
      await expect(
        service.ensureSeriesOwnershipIfProvided('author-1'),
      ).resolves.toBeUndefined();
      expect(seriesRepo.findOne).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when series does not exist', async () => {
      seriesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.ensureSeriesOwnershipIfProvided('author-1', 'series-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw ForbiddenException when series is not owned by author', async () => {
      seriesRepo.findOne.mockResolvedValue({
        id: 'series-1',
        authorId: 'other-author',
      } as Series);

      await expect(
        service.ensureSeriesOwnershipIfProvided('author-1', 'series-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should not throw when series is owned by author', async () => {
      seriesRepo.findOne.mockResolvedValue({
        id: 'series-1',
        authorId: 'author-1',
      } as Series);

      await expect(
        service.ensureSeriesOwnershipIfProvided('author-1', 'series-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    const baseDto: CreateBookDto = {
      title: 'Test Book',
      shortDescription: 'short',
      fullDescription: 'full',
      pageCount: 100,
      ageRating: undefined as any,
      distributionType: undefined as any,
      applicationDeadline: new Date().toISOString(),
      totalCopies: 10,
      availableCopies: 5,
      genres: [],
    };

    it('should throw ForbiddenException when availableCopies > totalCopies', async () => {
      const dto: CreateBookDto = {
        ...baseDto,
        totalCopies: 5,
        availableCopies: 10,
      };

      await expect(
        service.create('author-1', UserType.AUTHOR, dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw ForbiddenException when availableCopies < 0', async () => {
      const dto: CreateBookDto = {
        ...baseDto,
        totalCopies: 5,
        availableCopies: -1,
      };

      await expect(
        service.create('author-1', UserType.AUTHOR, dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw BadRequestException when reviewDeadline <= applicationDeadline', async () => {
      const now = new Date();
      const dto: CreateBookDto = {
        ...baseDto,
        applicationDeadline: now.toISOString(),
        reviewDeadline: now.toISOString(),
      };

      await expect(
        service.create('author-1', UserType.AUTHOR, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should create book and related genres when data is valid', async () => {
      const dto: CreateBookDto = {
        ...baseDto,
        genres: [1, 2],
      };

      const savedBook: Book = {
        id: 'book-1',
      } as any;

      bookRepo.create.mockReturnValue(savedBook);
      bookRepo.save.mockResolvedValue(savedBook);

      genreRepo.find.mockResolvedValue([
        { id: 1, name: 'G1' } as Genre,
        { id: 2, name: 'G2' } as Genre,
      ]);

      bookGenreRepo.create.mockImplementation(
        (data: Partial<BookGenre>) => data as any,
      );

      bookGenreRepo.save.mockResolvedValue([]);

      bookRepo.findOne.mockResolvedValue(savedBook);

      const result = await service.create('author-1', UserType.AUTHOR, dto);

      expect(bookRepo.create).toHaveBeenCalled();
      expect(bookRepo.save).toHaveBeenCalled();
      expect(genreRepo.find).toHaveBeenCalledWith({
        where: { id: expect.any(Object) },
      });
      expect(bookGenreRepo.save).toHaveBeenCalled();
      expect(result).toEqual(savedBook);
    });

    it('should throw BadRequestException when some genre ids are invalid', async () => {
      const dto: CreateBookDto = {
        ...baseDto,
        genres: [1, 2],
      };

      const savedBook: Book = {
        id: 'book-1',
      } as any;

      bookRepo.create.mockReturnValue(savedBook);
      bookRepo.save.mockResolvedValue(savedBook);

      genreRepo.find.mockResolvedValue([{ id: 1, name: 'G1' } as Genre]);

      await expect(
        service.create('author-1', UserType.AUTHOR, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createWithFile', () => {
    const baseDto: CreateBookDto = {
      title: 'Test Book',
      applicationDeadline: new Date().toISOString(),
      distributionType: 'digital' as any,
    } as any;

    it('throws when non-physical distribution and file is missing', async () => {
      const createdBook: Book = { id: 'book-1' } as any;
      jest.spyOn(service, 'create').mockResolvedValue(createdBook);

      await expect(
        service.createWithFile('author-1', UserType.AUTHOR, baseDto, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(booksFileService.uploadBookFile).not.toHaveBeenCalled();
    });

    it('uploads file when non-physical distribution and file is provided', async () => {
      const createdBook: Book = { id: 'book-1' } as any;
      jest.spyOn(service, 'create').mockResolvedValue(createdBook);

      const uploadedBook: Book = { id: 'book-1', fileUrl: 'url' } as any;
      booksFileService.uploadBookFile.mockResolvedValue({
        book: uploadedBook,
      } as any);

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'book.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 10,
        buffer: Buffer.from('test'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.createWithFile(
        'author-1',
        UserType.AUTHOR,
        baseDto,
        file,
      );

      expect(booksFileService.uploadBookFile).toHaveBeenCalledWith(
        'author-1',
        UserType.AUTHOR,
        createdBook.id,
        file,
      );
      expect(result).toBe(uploadedBook);
    });

    it('does not require file for physical distribution', async () => {
      const dto: CreateBookDto = {
        ...baseDto,
        distributionType: 'physical' as any,
      };
      const createdBook: Book = { id: 'book-1' } as any;
      jest.spyOn(service, 'create').mockResolvedValue(createdBook);

      const result = await service.createWithFile(
        'author-1',
        UserType.AUTHOR,
        dto,
        undefined,
      );

      expect(booksFileService.uploadBookFile).not.toHaveBeenCalled();
      expect(result).toBe(createdBook);
    });

    it('uploads file when physical distribution but file is provided', async () => {
      const dto: CreateBookDto = {
        ...baseDto,
        distributionType: DistributionType.PHYSICAL,
      } as any;
      const createdBook: Book = { id: 'book-1' } as any;
      jest.spyOn(service, 'create').mockResolvedValue(createdBook);
      const uploadedBook: Book = { id: 'book-1', fileUrl: 'url' } as any;
      booksFileService.uploadBookFile.mockResolvedValue({
        book: uploadedBook,
      } as any);
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'book.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 10,
        buffer: Buffer.from('x'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.createWithFile(
        'author-1',
        UserType.AUTHOR,
        dto,
        file,
      );

      expect(booksFileService.uploadBookFile).toHaveBeenCalledWith(
        'author-1',
        UserType.AUTHOR,
        createdBook.id,
        file,
      );
      expect(result).toBe(uploadedBook);
    });
  });

  describe('findMy', () => {
    it('returns books sorted by application_count when sortBy is application_count', async () => {
      const books: Book[] = [
        { id: 'b1', authorId: 'author-1', createdAt: new Date(1000) } as any,
        { id: 'b2', authorId: 'author-1', createdAt: new Date(2000) } as any,
      ];
      bookRepo.find.mockResolvedValue(books);
      const chain = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { bookId: 'b2', count: '5' },
          { bookId: 'b1', count: '2' },
        ]),
      };
      applicationRepo.createQueryBuilder.mockReturnValue(chain);

      const result = await service.findMy('author-1', 'application_count');

      expect(result[0].id).toBe('b2');
      expect(result[1].id).toBe('b1');
    });

    it('returns books sorted by title when sortBy is title', async () => {
      const books: Book[] = [
        { id: 'b1', title: 'Zebra', authorId: 'author-1' } as any,
        { id: 'b2', title: 'Alpha', authorId: 'author-1' } as any,
      ];
      bookRepo.find.mockResolvedValue(books);

      const result = await service.findMy('author-1', 'title');

      expect(result[0].title).toBe('Alpha');
      expect(result[1].title).toBe('Zebra');
    });

    it('returns books sorted by status when sortBy is status', async () => {
      const books: Book[] = [
        { id: 'b1', status: 'active', authorId: 'author-1' } as any,
        { id: 'b2', status: 'draft', authorId: 'author-1' } as any,
      ];
      bookRepo.find.mockResolvedValue(books);

      const result = await service.findMy('author-1', 'status');

      expect(result[0].status).toBe('active');
      expect(result[1].status).toBe('draft');
    });

    it('returns books sorted by date_created by default', async () => {
      const books: Book[] = [
        { id: 'b1', authorId: 'author-1', createdAt: new Date(1000) } as any,
        { id: 'b2', authorId: 'author-1', createdAt: new Date(2000) } as any,
      ];
      bookRepo.find.mockResolvedValue(books);

      const result = await service.findMy('author-1');

      expect(result[0].id).toBe('b2');
      expect(result[1].id).toBe('b1');
    });
  });

  describe('findOnePublic', () => {
    it('throws NotFoundException when book does not exist', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOnePublic('book-1', 'reader-1', UserType.READER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('keeps file fields when user is author', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        title: 'Test',
        fileUrl: 'url',
        fileSize: 123,
        fileType: 'pdf',
      } as any;
      bookRepo.findOne.mockResolvedValue(book);

      const result = await service.findOnePublic(
        'book-1',
        'author-1',
        UserType.AUTHOR,
      );

      expect((result as any).fileUrl).toBe('url');
      expect((result as any).fileSize).toBe(123);
      expect((result as any).fileType).toBe('pdf');
    });

    it('removes file fields for non-author without approved application', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        title: 'Test',
        fileUrl: 'url',
        fileSize: 123,
        fileType: 'pdf',
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.findOne.mockResolvedValue(null);

      const result = await service.findOnePublic(
        'book-1',
        'reader-1',
        UserType.READER,
      );

      expect(result.id).toBe('book-1');
      expect((result as any).fileUrl).toBeUndefined();
      expect((result as any).fileSize).toBeUndefined();
      expect((result as any).fileType).toBeUndefined();
    });

    it('keeps file fields for approved reader', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        title: 'Test',
        fileUrl: 'url',
        fileSize: 123,
        fileType: 'pdf',
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.findOne.mockResolvedValue({
        id: 'app-1',
        status: ApplicationStatus.APPROVED,
      } as any);

      const result = await service.findOnePublic(
        'book-1',
        'reader-1',
        UserType.READER,
      );

      expect((result as any).fileUrl).toBe('url');
      expect((result as any).fileSize).toBe(123);
      expect((result as any).fileType).toBe('pdf');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when book does not exist', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.remove('author-1', UserType.AUTHOR, 'book-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when book is not owned by author', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'other-author',
      } as Book);

      await expect(
        service.remove('author-1', UserType.AUTHOR, 'book-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('deletes only book when no file or cover url', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        fileUrl: null,
        coverImageUrl: null,
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      bookRepo.delete.mockResolvedValue({} as any);

      await service.remove('author-1', UserType.AUTHOR, 'book-1');

      expect(filesService.deleteFileByUrl).not.toHaveBeenCalled();
      expect(bookRepo.delete).toHaveBeenCalledWith('book-1');
    });

    it('deletes associated files and book when authorized', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        fileUrl: 'file-url',
        coverImageUrl: 'cover-url',
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      bookRepo.delete.mockResolvedValue({} as any);

      await service.remove('author-1', UserType.AUTHOR, 'book-1');

      expect(filesService.deleteFileByUrl).toHaveBeenCalledWith('file-url');
      expect(filesService.deleteFileByUrl).toHaveBeenCalledWith('cover-url');
      expect(bookRepo.delete).toHaveBeenCalledWith('book-1');
    });
  });

  describe('publish', () => {
    it('throws NotFoundException when book does not exist', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.publish('author-1', UserType.AUTHOR, 'book-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when book is not owned by author', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'other-author',
      } as Book);

      await expect(
        service.publish('author-1', UserType.AUTHOR, 'book-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sets status to ACTIVE and calls findOnePublic', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      bookRepo.save.mockResolvedValue(book);

      const publicBook: Book = { id: 'book-1' } as any;
      const spy = jest
        .spyOn(service, 'findOnePublic')
        .mockResolvedValue(publicBook);

      const result = await service.publish(
        'author-1',
        UserType.AUTHOR,
        'book-1',
      );

      expect(book.status).toBeDefined();
      expect(book.publishedAt).toBeInstanceOf(Date);
      expect(spy).toHaveBeenCalledWith('book-1', 'author-1', UserType.AUTHOR);
      expect(result).toBe(publicBook);
    });
  });

  describe('findOneForAuthor', () => {
    it('throws NotFoundException when book not found or not owned by author', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOneForAuthor('author-1', 'book-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns book when found for author', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        title: 'My Book',
      } as any;
      bookRepo.findOne.mockResolvedValue(book);

      const result = await service.findOneForAuthor('author-1', 'book-1');

      expect(result).toBe(book);
      expect(bookRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'book-1', authorId: 'author-1' },
      });
    });
  });

  describe('checkUserApplicationStatus', () => {
    it('returns false when no approved application exists', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      const result = await service.checkUserApplicationStatus(
        'user-1',
        'book-1',
      );

      expect(result).toBe(false);
    });

    it('returns true when approved application exists', async () => {
      applicationRepo.findOne.mockResolvedValue({
        id: 'app-1',
      } as any);

      const result = await service.checkUserApplicationStatus(
        'user-1',
        'book-1',
      );

      expect(result).toBe(true);
    });
  });

  describe('getBookAllReviews', () => {
    it('returns empty paginated result for reader with no review', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      const result = await service.getBookAllReviews(
        'reader-1',
        UserType.READER,
        'book-1',
        { skip: 0, take: 10 },
      );

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns single review for reader when review exists', async () => {
      const review: Review = {
        id: 'rev-1',
      } as any;
      reviewRepo.findOne.mockResolvedValue(review);

      const result = await service.getBookAllReviews(
        'reader-1',
        UserType.READER,
        'book-1',
        { skip: 0, take: 10 },
      );

      expect(result.data.length).toBe(1);
      expect(result.data[0]).toBe(review);
      expect(result.total).toBe(1);
    });

    it('returns paginated reviews for author', async () => {
      const book: Book = { id: 'book-1', authorId: 'author-1' } as any;
      bookRepo.findOne.mockResolvedValue(book);
      const reviews: Review[] = [{ id: 'rev-1' } as any];
      const chain = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([reviews, 1]),
      };
      reviewRepo.createQueryBuilder.mockReturnValue(chain);

      const result = await service.getBookAllReviews(
        'author-1',
        UserType.AUTHOR,
        'book-1',
        { skip: 0, take: 20 },
      );

      expect(result.data).toEqual(reviews);
      expect(result.total).toBe(1);
      expect(reviewRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when book is missing', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'book-1', {} as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when book is not owned by author', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'other-author',
      } as any;
      bookRepo.findOne.mockResolvedValue(book);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'book-1', {} as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when totalCopies is less than approved applications', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        totalCopies: 5,
        availableCopies: 5,
        applicationDeadline: new Date(),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.count.mockResolvedValue(3);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'book-1', {
          totalCopies: 2,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when availableCopies exceeds max allowed', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        totalCopies: 10,
        availableCopies: 6,
        applicationDeadline: new Date(),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.count.mockResolvedValue(4);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'book-1', {
          availableCopies: 7,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates simple fields and saves book', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        title: 'Old',
        totalCopies: 5,
        availableCopies: 5,
        applicationDeadline: new Date(),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.count.mockResolvedValue(0);
      bookRepo.save.mockImplementation(async (b: any) => b);

      const publicBook: Book = { id: 'book-1', title: 'New' } as any;
      jest.spyOn(service, 'findOnePublic').mockResolvedValue(publicBook);

      const result = await service.update(
        'author-1',
        UserType.AUTHOR,
        'book-1',
        { title: 'New' } as any,
      );

      expect(book.title).toBe('New');
      expect(result).toBe(publicBook);
    });

    it('throws ForbiddenException when updating seriesId to non-owned series', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        applicationDeadline: new Date(),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      seriesRepo.findOne.mockResolvedValue({
        id: 'series-1',
        authorId: 'other',
      } as any);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'book-1', {
          seriesId: 'series-1',
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('updates totalCopies and availableCopies when totalCopies is valid', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        totalCopies: 10,
        availableCopies: 5,
        applicationDeadline: new Date(),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.count.mockResolvedValue(3);
      bookRepo.save.mockImplementation(async (b: any) => b);
      jest.spyOn(service, 'findOnePublic').mockResolvedValue(book);

      await service.update('author-1', UserType.AUTHOR, 'book-1', {
        totalCopies: 8,
      } as any);

      expect(book.totalCopies).toBe(8);
      expect(book.availableCopies).toBe(5);
    });

    it('reverts status to ACTIVE when applicationDeadline extended from IN_PROGRESS', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        status: BookStatus.IN_PROGRESS,
        applicationDeadline: new Date(Date.now() - 86400000),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.count.mockResolvedValue(0);
      bookRepo.save.mockImplementation(async (b: any) => b);
      jest.spyOn(service, 'findOnePublic').mockResolvedValue(book);

      await service.update('author-1', UserType.AUTHOR, 'book-1', {
        applicationDeadline: new Date(Date.now() + 86400000).toISOString(),
      } as any);

      expect(book.status).toBe(BookStatus.ACTIVE);
    });

    it('reverts status to IN_PROGRESS when reviewDeadline extended from COMPLETED', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        status: BookStatus.COMPLETED,
        applicationDeadline: new Date(Date.now() - 86400000),
        reviewDeadline: new Date(Date.now() - 86400000),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.count.mockResolvedValue(0);
      bookRepo.save.mockImplementation(async (b: any) => b);
      jest.spyOn(service, 'findOnePublic').mockResolvedValue(book);

      await service.update('author-1', UserType.AUTHOR, 'book-1', {
        reviewDeadline: new Date(Date.now() + 86400000).toISOString(),
      } as any);

      expect(book.status).toBe(BookStatus.IN_PROGRESS);
    });

    it('throws BadRequestException when reviewDeadline <= applicationDeadline after update', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        applicationDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 86400000 * 2),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.count.mockResolvedValue(0);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'book-1', {
          reviewDeadline: new Date(Date.now()).toISOString(),
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException when availableCopies > totalCopies after other updates', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        totalCopies: 2,
        availableCopies: 5,
        applicationDeadline: new Date(),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.count.mockResolvedValue(0);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'book-1', {
          title: 'New',
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('replaces genres and throws when new genre ids invalid', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        applicationDeadline: new Date(),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.count.mockResolvedValue(0);
      bookRepo.save.mockImplementation(async (b: any) => b);
      bookGenreRepo.delete.mockResolvedValue({} as any);
      genreRepo.find.mockResolvedValue([{ id: 1 } as Genre]);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'book-1', {
          genres: [1, 2, 3],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('replaces genres when dto.genres provided and valid', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        applicationDeadline: new Date(),
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.count.mockResolvedValue(0);
      bookRepo.save.mockImplementation(async (b: any) => b);
      bookGenreRepo.delete.mockResolvedValue({} as any);
      genreRepo.find.mockResolvedValue([
        { id: 1 } as Genre,
        { id: 2 } as Genre,
      ]);
      bookGenreRepo.create.mockImplementation((data: any) => data);
      bookGenreRepo.save.mockResolvedValue([]);
      jest.spyOn(service, 'findOnePublic').mockResolvedValue(book);

      await service.update('author-1', UserType.AUTHOR, 'book-1', {
        genres: [1, 2],
      } as any);

      expect(bookGenreRepo.delete).toHaveBeenCalledWith({ bookId: 'book-1' });
      expect(bookGenreRepo.save).toHaveBeenCalled();
    });
  });

  describe('BooksQueryService wrappers', () => {
    it('browse delegates to booksQueryService', async () => {
      const expected = {
        data: [],
        total: 0,
        skip: 0,
        take: 10,
        hasMore: false,
      };
      booksQueryService.browse.mockResolvedValue(expected as any);

      const dto: any = { skip: 0, take: 10 };
      const result = await service.browse(dto, 'u1', UserType.READER);

      expect(booksQueryService.browse).toHaveBeenCalledWith(
        dto,
        'u1',
        UserType.READER,
      );
      expect(result).toBe(expected as any);
    });

    it('featured delegates to booksQueryService', async () => {
      const books: Book[] = [{ id: 'b1' } as any];
      booksQueryService.featured.mockResolvedValue(books);

      const result = await service.featured('u1', UserType.READER);

      expect(booksQueryService.featured).toHaveBeenCalledWith(
        'u1',
        UserType.READER,
      );
      expect(result).toBe(books);
    });

    it('recommendedForUser delegates to booksQueryService', async () => {
      const expected = {
        data: [],
        total: 0,
        skip: 0,
        take: 10,
        hasMore: false,
      };
      booksQueryService.recommendedForUser.mockResolvedValue(expected as any);

      const result = await service.recommendedForUser(
        'u1',
        { skip: 0, take: 10 },
        UserType.READER,
      );

      expect(booksQueryService.recommendedForUser).toHaveBeenCalledWith(
        'u1',
        { skip: 0, take: 10 },
        UserType.READER,
      );
      expect(result).toEqual(expected);
    });

    it('trending delegates to booksQueryService', async () => {
      const expected = [{ book: { id: 'b1' } as any, applicationCount: 5 }];
      booksQueryService.trending.mockResolvedValue(expected as any);

      const result = await service.trending(
        { limit: 10 },
        'u1',
        UserType.READER,
      );

      expect(booksQueryService.trending).toHaveBeenCalledWith(
        { limit: 10 },
        'u1',
        UserType.READER,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('BooksAnalyticsService wrappers', () => {
    it('stats delegates to booksAnalyticsService', async () => {
      const value = { bookId: 'b1' };
      booksAnalyticsService.stats.mockResolvedValue(value as any);

      const result = await service.stats('a1', 'b1');

      expect(booksAnalyticsService.stats).toHaveBeenCalledWith('a1', 'b1');
      expect(result).toBe(value as any);
    });

    it('analytics delegates to booksAnalyticsService', async () => {
      const value = { analytics: true };
      booksAnalyticsService.analytics.mockResolvedValue(value as any);

      const result = await service.analytics('a1', 'b1');

      expect(booksAnalyticsService.analytics).toHaveBeenCalledWith('a1', 'b1');
      expect(result).toBe(value as any);
    });

    it('getAuthorAnalytics delegates to booksAnalyticsService', async () => {
      const value = { totalViews: 100 };
      booksAnalyticsService.getAuthorAnalytics.mockResolvedValue(value as any);

      const result = await service.getAuthorAnalytics('a1', '7d');

      expect(booksAnalyticsService.getAuthorAnalytics).toHaveBeenCalledWith(
        'a1',
        '7d',
      );
      expect(result).toBe(value as any);
    });

    it('getBookPerformanceComparison delegates to booksAnalyticsService', async () => {
      const value = { comparison: [] };
      booksAnalyticsService.getBookPerformanceComparison.mockResolvedValue(
        value as any,
      );

      const result = await service.getBookPerformanceComparison('a1');

      expect(
        booksAnalyticsService.getBookPerformanceComparison,
      ).toHaveBeenCalledWith('a1');
      expect(result).toBe(value as any);
    });
  });

  describe('BooksFileService wrappers', () => {
    it('updateFileInfo delegates to booksFileService', async () => {
      const value = { id: 'b1' };
      booksFileService.updateFileInfo.mockResolvedValue(value as any);

      const result = await service.updateFileInfo(
        'a1',
        UserType.AUTHOR,
        'b1',
        'url',
        10,
        'pdf',
      );

      expect(booksFileService.updateFileInfo).toHaveBeenCalledWith(
        'a1',
        UserType.AUTHOR,
        'b1',
        'url',
        10,
        'pdf',
      );
      expect(result).toBe(value as any);
    });

    it('updateCoverImage delegates to booksFileService', async () => {
      const value = { id: 'b1' };
      booksFileService.updateCoverImage.mockResolvedValue(value as any);

      const result = await service.updateCoverImage(
        'a1',
        UserType.AUTHOR,
        'b1',
        'url',
      );

      expect(booksFileService.updateCoverImage).toHaveBeenCalledWith(
        'a1',
        UserType.AUTHOR,
        'b1',
        'url',
      );
      expect(result).toBe(value as any);
    });

    it('uploadBookFile delegates to booksFileService', async () => {
      const value = { id: 'b1' };
      booksFileService.uploadBookFile.mockResolvedValue(value as any);

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'book.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 10,
        buffer: Buffer.from('test'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.uploadBookFile(
        'a1',
        UserType.AUTHOR,
        'b1',
        file,
      );

      expect(booksFileService.uploadBookFile).toHaveBeenCalledWith(
        'a1',
        UserType.AUTHOR,
        'b1',
        file,
      );
      expect(result).toBe(value as any);
    });

    it('uploadCoverImage delegates to booksFileService', async () => {
      const value = { id: 'b1' };
      booksFileService.uploadCoverImage.mockResolvedValue(value as any);
      const file: Express.Multer.File = {
        fieldname: 'cover',
        originalname: 'cover.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 100,
        buffer: Buffer.from('x'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.uploadCoverImage(
        'a1',
        UserType.AUTHOR,
        'b1',
        file,
      );

      expect(booksFileService.uploadCoverImage).toHaveBeenCalledWith(
        'a1',
        UserType.AUTHOR,
        'b1',
        file,
      );
      expect(result).toBe(value as any);
    });

    it('removeCoverImage delegates to booksFileService', async () => {
      const value = { id: 'b1' };
      booksFileService.removeCoverImage.mockResolvedValue(value as any);

      const result = await service.removeCoverImage(
        'a1',
        UserType.AUTHOR,
        'b1',
      );

      expect(booksFileService.removeCoverImage).toHaveBeenCalledWith(
        'a1',
        UserType.AUTHOR,
        'b1',
      );
      expect(result).toBe(value as any);
    });
  });
});
