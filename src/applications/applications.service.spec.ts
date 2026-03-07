import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { Application } from './entity/application.entity';
import { Book } from '../books/entity';
import { User } from '../users/entity/user.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { Review } from '../reviews/entity/review.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationStatus } from './enums';
import { BookStatus, SelectionMethod } from '../books/enums';
import { UserType } from '../users/enums';
import { UserActivityService } from '../user-activity/user-activity.service';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    decrement: jest.fn(),
  };
}

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let applicationRepo: MockRepo<Application>;
  let bookRepo: MockRepo<Book>;
  let userRepo: MockRepo<User>;
  let userAddressRepo: MockRepo;
  let reviewRepo: MockRepo;
  let userActivityService: jest.Mocked<UserActivityService>;
  const notificationService = {
    notifyApplicationApproved: jest.fn().mockResolvedValue(undefined),
    notifyApplicationRejected: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: getRepositoryToken(Application),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(Book),
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
          provide: getRepositoryToken(Review),
          useValue: createMockRepo(),
        },
        {
          provide: 'NotificationService',
          useValue: notificationService,
        },
        {
          provide: UserActivityService,
          useValue: {
            logBookApplied: jest.fn(),
            logBookStarted: jest.fn(),
            logBookCompleted: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    applicationRepo = module.get(getRepositoryToken(Application));
    bookRepo = module.get(getRepositoryToken(Book));
    userRepo = module.get(getRepositoryToken(User));
    userAddressRepo = module.get(getRepositoryToken(UserAddress));
    reviewRepo = module.get(getRepositoryToken(Review));
    userActivityService = module.get(UserActivityService);
    jest
      .spyOn<any, any>(service as any, 'isUserEligibleForBook')
      .mockReturnValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const baseDto: CreateApplicationDto = {
      bookId: 'book-1',
      applicationMessage: 'I want to read',
    } as any;

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when email not verified', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'reader-1',
        emailVerified: false,
      } as User);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when book not found', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'reader-1',
        emailVerified: true,
      } as User);
      bookRepo.findOne.mockResolvedValue(null);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should create approved application for FIRST_COME digital book', async () => {
      const user: User = {
        id: 'reader-1',
        emailVerified: true,
      } as any;
      const book: Book = {
        id: 'book-1',
        status: 'active' as any,
        selectionMethod: 'first_come' as any,
        availableCopies: 2,
        applicationDeadline: new Date(Date.now() + 60 * 60 * 1000),
        distributionType: 'digital' as any,
        title: 'Test Book',
      } as any;

      userRepo.findOne.mockResolvedValue(user);
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.findOne.mockResolvedValue(null);

      const created: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED,
      } as any;

      applicationRepo.create.mockReturnValue(created);
      applicationRepo.save.mockResolvedValue(created);

      const result = await service.create('reader-1', baseDto);

      expect(applicationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          readerId: 'reader-1',
          bookId: 'book-1',
          status: ApplicationStatus.APPROVED,
        }),
      );
      expect(userActivityService.logBookApplied).toHaveBeenCalled();
      expect(notificationService.notifyApplicationApproved).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should set book status to IN_PROGRESS when last copy is taken', async () => {
      const user: User = {
        id: 'reader-1',
        emailVerified: true,
      } as any;
      const book: Book = {
        id: 'book-1',
        status: BookStatus.ACTIVE,
        selectionMethod: SelectionMethod.FIRST_COME,
        availableCopies: 1,
        applicationDeadline: new Date(Date.now() + 60 * 60 * 1000),
        distributionType: 'digital' as any,
        title: 'Test Book',
      } as any;

      userRepo.findOne.mockResolvedValue(user);
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.findOne.mockResolvedValue(null);
      applicationRepo.create.mockImplementation((d: any) => ({
        ...d,
        id: 'app-1',
      }));
      applicationRepo.save.mockImplementation(async (a: any) => a);
      bookRepo.save.mockImplementation(async (b: any) => b);

      await service.create('reader-1', baseDto);

      expect(bookRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          availableCopies: 0,
          status: BookStatus.IN_PROGRESS,
        }),
      );
    });

    it('should still create application when logBookApplied throws', async () => {
      const user: User = {
        id: 'reader-1',
        emailVerified: true,
      } as any;
      const book: Book = {
        id: 'book-1',
        status: 'active' as any,
        selectionMethod: 'first_come' as any,
        availableCopies: 2,
        applicationDeadline: new Date(Date.now() + 60 * 60 * 1000),
        distributionType: 'digital' as any,
        title: 'Test Book',
      } as any;

      userRepo.findOne.mockResolvedValue(user);
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.findOne.mockResolvedValue(null);
      const created: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED,
      } as any;
      applicationRepo.create.mockReturnValue(created);
      applicationRepo.save.mockResolvedValue(created);
      userActivityService.logBookApplied.mockRejectedValue(
        new Error('Activity service down'),
      );

      const result = await service.create('reader-1', baseDto);

      expect(result).toEqual(created);
      expect(applicationRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user not eligible by age', async () => {
      const user: User = {
        id: 'reader-1',
        emailVerified: true,
      } as any;
      const book: Book = {
        id: 'book-1',
        status: 'active' as any,
        selectionMethod: 'author_selects' as any,
        availableCopies: 1,
        applicationDeadline: new Date(Date.now() + 60 * 60 * 1000),
      } as any;

      userRepo.findOne.mockResolvedValue(user);
      bookRepo.findOne.mockResolvedValue(book);
      applicationRepo.findOne.mockResolvedValue(null);

      (
        jest.spyOn<any, any>(
          service as any,
          'isUserEligibleForBook',
        ) as jest.SpyInstance
      ).mockReturnValue(false);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when book is not active', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'reader-1',
        emailVerified: true,
      } as User);
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        status: 'in_progress' as any,
      } as Book);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw ConflictException when application already exists', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'reader-1',
        emailVerified: true,
      } as User);
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        status: 'active' as any,
        selectionMethod: 'author_selects' as any,
        availableCopies: 1,
        applicationDeadline: new Date(Date.now() + 60 * 60 * 1000),
      } as Book);
      applicationRepo.findOne.mockResolvedValue({
        id: 'app-existing',
        readerId: 'reader-1',
        bookId: 'book-1',
      } as Application);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('should throw BadRequestException when no available copies', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'reader-1',
        emailVerified: true,
      } as User);
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        status: 'active' as any,
        selectionMethod: 'author_selects' as any,
        availableCopies: 0,
        applicationDeadline: new Date(Date.now() + 60 * 60 * 1000),
      } as Book);
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when application deadline passed', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'reader-1',
        emailVerified: true,
      } as User);
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        status: 'active' as any,
        selectionMethod: 'author_selects' as any,
        availableCopies: 1,
        applicationDeadline: new Date(Date.now() - 60 * 60 * 1000),
      } as Book);
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should create pending application for author_selects book', async () => {
      const user: User = { id: 'reader-1', emailVerified: true } as any;
      const book: Book = {
        id: 'book-1',
        status: 'active' as any,
        selectionMethod: 'author_selects' as any,
        availableCopies: 2,
        applicationDeadline: new Date(Date.now() + 60 * 60 * 1000),
        distributionType: 'digital' as any,
        title: 'Test',
      } as any;
      userRepo.findOne.mockResolvedValue(user);
      bookRepo.findOne.mockResolvedValue(book);
      const created: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING,
      } as any;
      applicationRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(created);
      applicationRepo.create.mockReturnValue(created);
      applicationRepo.save.mockResolvedValue(created);

      const result = await service.create('reader-1', baseDto);

      expect(result).toBeDefined();
      expect(applicationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ApplicationStatus.PENDING,
        }),
      );
    });
  });

  describe('checkApplication', () => {
    it('returns hasApplied false when no application exists', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      const result = await service.checkApplication('reader-1', 'book-1');

      expect(result).toEqual({
        hasApplied: false,
        application: null,
      });
    });

    it('sanitizes book file fields when not approved or reviewed', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING as any,
        readingStatus: 'not_started' as any,
        book: {
          id: 'book-1',
          fileUrl: 'url',
          fileSize: 123,
          fileType: 'pdf',
        } as any,
      } as any;

      applicationRepo.findOne.mockResolvedValue(app);

      const result = await service.checkApplication('reader-1', 'book-1');

      expect(result.hasApplied).toBe(true);
      expect(result.application!.book).toBeDefined();
      expect((result.application!.book as any).fileUrl).toBeUndefined();
      expect((result.application!.book as any).fileSize).toBeUndefined();
      expect((result.application!.book as any).fileType).toBeUndefined();
    });
  });

  describe('findMyApplications', () => {
    it('throws BadRequestException when readerId is empty', async () => {
      await expect(
        service.findMyApplications('', { skip: 0, take: 20 } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns paginated applications with sanitization', async () => {
      const chain = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          getCount: jest.fn().mockResolvedValue(0),
        }),
        getMany: jest.fn().mockResolvedValue([]),
      };
      applicationRepo.createQueryBuilder.mockReturnValue(chain);

      const result = await service.findMyApplications('reader-1', {
        skip: 0,
        take: 20,
      } as any);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('adds multiple-genre filter when genres has more than one id', async () => {
      const chain = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          getCount: jest.fn().mockResolvedValue(0),
        }),
        getMany: jest.fn().mockResolvedValue([]),
      };
      applicationRepo.createQueryBuilder.mockReturnValue(chain);

      await service.findMyApplications('reader-1', {
        skip: 0,
        take: 20,
        genres: [1, 2, 3],
      } as any);

      expect(chain.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(DISTINCT bg.genre_id)'),
        expect.objectContaining({ genreIds: [1, 2, 3], genreCount: 3 }),
      );
    });

    it('adds minAvgRating and maxAvgRating filters when provided', async () => {
      const chain = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          getCount: jest.fn().mockResolvedValue(1),
        }),
        getMany: jest.fn().mockResolvedValue([]),
      };
      applicationRepo.createQueryBuilder.mockReturnValue(chain);

      await service.findMyApplications('reader-1', {
        skip: 0,
        take: 20,
        minAvgRating: 3,
        maxAvgRating: 5,
      } as any);

      expect(chain.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('AVG(r.rating)'),
        expect.objectContaining({ minAvgRating: 3 }),
      );
      expect(chain.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('AVG(r.rating)'),
        expect.objectContaining({ maxAvgRating: 5 }),
      );
    });

    it('sanitizes book file fields for non-approved non-reviewed applications', async () => {
      const chain = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          getCount: jest.fn().mockResolvedValue(1),
        }),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'app-1',
            status: ApplicationStatus.PENDING,
            readingStatus: 'not_started' as any,
            book: {
              id: 'book-1',
              fileUrl: 'url',
              fileSize: 100,
              fileType: 'pdf',
            },
          },
        ]),
      };
      applicationRepo.createQueryBuilder.mockReturnValue(chain);

      const result = await service.findMyApplications('reader-1', {
        skip: 0,
        take: 20,
      } as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].book.fileUrl).toBeUndefined();
      expect(result.data[0].book.fileSize).toBeUndefined();
      expect(result.data[0].book.fileType).toBeUndefined();
    });
  });

  describe('getBookApplications', () => {
    it('throws NotFoundException when book not found', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getBookApplications('book-1', 'author-1', UserType.AUTHOR, {
          skip: 0,
          take: 20,
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when user is not book author', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'other-author',
      } as Book);

      await expect(
        service.getBookApplications('book-1', 'author-1', UserType.AUTHOR, {
          skip: 0,
          take: 20,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns paginated list for book author', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        distributionType: 'digital' as any,
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      const chain = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      applicationRepo.createQueryBuilder.mockReturnValue(chain);

      const result = await service.getBookApplications(
        'book-1',
        'author-1',
        UserType.AUTHOR,
        { skip: 0, take: 20 } as any,
      );

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when application is missing', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('app-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user is neither reader nor author', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        book: { authorId: 'author-1' } as any,
      } as any;

      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.findOne('app-1', 'other-user'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sanitizes book file fields for non-author when not approved or reviewed', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.PENDING as any,
        readingStatus: 'not_started' as any,
        book: {
          id: 'book-1',
          authorId: 'author-1',
          fileUrl: 'url',
          fileSize: 123,
          fileType: 'pdf',
        } as any,
      } as any;

      applicationRepo.findOne.mockResolvedValue(app);

      const result = await service.findOne('app-1', 'reader-1');

      expect((result.book as any).fileUrl).toBeUndefined();
      expect((result.book as any).fileSize).toBeUndefined();
      expect((result.book as any).fileType).toBeUndefined();
    });
  });

  describe('updateReadingStatus', () => {
    it('throws NotFoundException when application does not exist', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateReadingStatus('app-1', 'reader-1', {
          readingStatus: 'currently_reading' as any,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when application is not approved', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.updateReadingStatus('app-1', 'reader-1', {
          readingStatus: 'currently_reading' as any,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sets readingStartedAt and logs activity when status becomes currently_reading', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED as any,
        readingStatus: 'not_started' as any,
        readingStartedAt: null,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.updateReadingStatus('app-1', 'reader-1', {
        readingStatus: 'currently_reading' as any,
      });

      expect(result.readingStatus).toBe('currently_reading');
      expect(result.readingStartedAt).toBeInstanceOf(Date);
      expect(userActivityService.logBookStarted).toHaveBeenCalledWith(
        'reader-1',
        app.bookId,
        app.id,
      );
    });

    it('sets readingCompletedAt and logs activity when status becomes for_review', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED as any,
        readingStatus: 'currently_reading' as any,
        readingCompletedAt: null,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.updateReadingStatus('app-1', 'reader-1', {
        readingStatus: 'for_review' as any,
      });

      expect(result.readingStatus).toBe('for_review');
      expect(result.readingCompletedAt).toBeInstanceOf(Date);
      expect(userActivityService.logBookCompleted).toHaveBeenCalledWith(
        'reader-1',
        app.bookId,
        app.id,
      );
    });
  });

  describe('withdrawApplication', () => {
    it('throws NotFoundException when application does not exist', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.withdrawApplication('app-1', 'reader-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when application is not pending', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.withdrawApplication('app-1', 'reader-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sets status to WITHDRAWN when pending', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.PENDING as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.withdrawApplication('app-1', 'reader-1');

      expect(result.status).toBe(ApplicationStatus.WITHDRAWN);
      expect(applicationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ApplicationStatus.WITHDRAWN,
        }),
      );
    });
  });

  describe('markCopyReceived', () => {
    it('throws NotFoundException when application does not exist', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markCopyReceived('app-1', 'reader-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when application is not approved', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.PENDING as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.markCopyReceived('app-1', 'reader-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sets copyReceivedAt when approved', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED as any,
        copyReceivedAt: null,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.markCopyReceived('app-1', 'reader-1');

      expect(result.copyReceivedAt).toBeInstanceOf(Date);
      expect(applicationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'app-1',
        }),
      );
    });
  });

  describe('updateApplicationStatus', () => {
    it('throws NotFoundException when application not found', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateApplicationStatus('app-1', 'author-1', UserType.AUTHOR, {
          status: ApplicationStatus.APPROVED,
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when book is not owned by author', async () => {
      const app: Application = {
        id: 'app-1',
        book: { authorId: 'other-author' } as any,
        status: ApplicationStatus.PENDING as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.updateApplicationStatus('app-1', 'author-1', UserType.AUTHOR, {
          status: ApplicationStatus.APPROVED,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when application is not pending', async () => {
      const app: Application = {
        id: 'app-1',
        book: { authorId: 'author-1' } as any,
        status: ApplicationStatus.APPROVED as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.updateApplicationStatus('app-1', 'author-1', UserType.AUTHOR, {
          status: ApplicationStatus.REJECTED,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('approves application, decrements copies and sends notification', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        book: {
          id: 'book-1',
          authorId: 'author-1',
          distributionType: 'digital',
          status: BookStatus.ACTIVE,
        } as any,
        status: ApplicationStatus.PENDING as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const book: Book = {
        id: 'book-1',
        title: 'Title',
        availableCopies: 1,
        status: BookStatus.ACTIVE,
      } as any;
      bookRepo.decrement.mockResolvedValue({} as any);
      bookRepo.findOne.mockResolvedValue(book);
      bookRepo.save.mockResolvedValue(book);

      const result = await service.updateApplicationStatus(
        'app-1',
        'author-1',
        UserType.AUTHOR,
        { status: ApplicationStatus.APPROVED } as any,
      );

      expect(result.status).toBe(ApplicationStatus.APPROVED);
      expect(notificationService.notifyApplicationApproved).toHaveBeenCalled();
    });

    it('rejects application and sends rejection notification', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        book: {
          id: 'book-1',
          authorId: 'author-1',
          title: 'Title',
        } as any,
        status: ApplicationStatus.PENDING as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);
      bookRepo.findOne.mockResolvedValue({ id: 'book-1', title: 'Title' });

      const result = await service.rejectApplication(
        'app-1',
        'author-1',
        UserType.AUTHOR,
      );

      expect(result.status).toBe(ApplicationStatus.REJECTED);
      expect(notificationService.notifyApplicationRejected).toHaveBeenCalled();
    });
  });

  describe('update (markCopySent / markCopyReceived)', () => {
    it('throws NotFoundException when application not found', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('app-1', 'user-1', UserType.READER, {} as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows author to set markCopySent for approved application', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED as any,
        book: { authorId: 'author-1' } as any,
        copySentAt: null,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.update(
        'app-1',
        'author-1',
        UserType.AUTHOR,
        { markCopySent: true } as any,
      );

      expect(result.copySentAt).toBeInstanceOf(Date);
    });

    it('allows reader to set markCopyReceived for approved application', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED as any,
        book: { authorId: 'author-1' } as any,
        copyReceivedAt: null,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.update(
        'app-1',
        'reader-1',
        UserType.READER,
        { markCopyReceived: true } as any,
      );

      expect(result.copyReceivedAt).toBeInstanceOf(Date);
    });

    it('throws ForbiddenException when non-author sets markCopySent', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED as any,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'reader-1', UserType.READER, {
          markCopySent: true,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when non-reader sets markCopyReceived', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED as any,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'author-1', UserType.AUTHOR, {
          markCopyReceived: true,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when non-reader updates applicationMessage', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING as any,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'author-1', UserType.AUTHOR, {
          applicationMessage: 'New message',
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when non-author tries to update status', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING as any,
        book: {
          authorId: 'author-1',
          selectionMethod: SelectionMethod.FIRST_COME,
        } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'reader-1', UserType.READER, {
          status: ApplicationStatus.APPROVED,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when author updates status but application not pending', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED as any,
        book: {
          authorId: 'author-1',
          selectionMethod: SelectionMethod.FIRST_COME,
        } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'author-1', UserType.AUTHOR, {
          status: ApplicationStatus.REJECTED,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows author to approve application and notifies reader', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING as any,
        book: {
          authorId: 'author-1',
          selectionMethod: SelectionMethod.FIRST_COME,
          distributionType: 'digital' as any,
        } as any,
        copySentAt: null,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);
      bookRepo.findOne.mockResolvedValue({ id: 'book-1', title: 'Test Book' });

      const result = await service.update(
        'app-1',
        'author-1',
        UserType.AUTHOR,
        {
          status: ApplicationStatus.APPROVED,
          authorNotes: 'Welcome',
        } as any,
      );

      expect(bookRepo.decrement).toHaveBeenCalledWith(
        { id: 'book-1' },
        'availableCopies',
        1,
      );
      expect(result.copySentAt).toBeInstanceOf(Date);
      expect(
        notificationService.notifyApplicationApproved,
      ).toHaveBeenCalledWith('reader-1', 'book-1', 'Test Book', 'app-1');
    });

    it('allows author to reject application and notifies reader', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING as any,
        book: {
          authorId: 'author-1',
          selectionMethod: SelectionMethod.FIRST_COME,
        } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);
      bookRepo.findOne.mockResolvedValue({ id: 'book-1', title: 'Test Book' });

      await service.update('app-1', 'author-1', UserType.AUTHOR, {
        status: ApplicationStatus.REJECTED,
        authorNotes: 'No slots',
      } as any);

      expect(
        notificationService.notifyApplicationRejected,
      ).toHaveBeenCalledWith('reader-1', 'book-1', 'Test Book', 'app-1');
    });

    it('throws ForbiddenException when updating applicationMessage and status not pending', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED as any,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'reader-1', UserType.READER, {
          applicationMessage: 'New message',
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when updating status for lottery book', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING as any,
        book: {
          authorId: 'author-1',
          selectionMethod: SelectionMethod.LOTTERY,
        } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'author-1', UserType.AUTHOR, {
          status: ApplicationStatus.APPROVED,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException when non-reader updates readingStatus', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED as any,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'author-1', UserType.AUTHOR, {
          readingStatus: 'currently_reading' as any,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when reader updates readingStatus and app not approved', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING as any,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'reader-1', UserType.READER, {
          readingStatus: 'currently_reading' as any,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when author sets markCopySent for non-approved application', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING as any,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'author-1', UserType.AUTHOR, {
          markCopySent: true,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when reader sets markCopyReceived for non-approved application', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING as any,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'reader-1', UserType.READER, {
          markCopyReceived: true,
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('bulkUpdateApplicationStatus', () => {
    it('throws NotFoundException when book not found', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.bulkUpdateApplicationStatus(
          'book-1',
          'author-1',
          UserType.AUTHOR,
          {
            applicationIds: ['app-1'],
            action: ApplicationStatus.APPROVED,
          } as any,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when not book author', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'other',
        selectionMethod: 'author_selects' as any,
      } as Book);

      await expect(
        service.bulkUpdateApplicationStatus(
          'book-1',
          'author-1',
          UserType.AUTHOR,
          {
            applicationIds: ['app-1'],
            action: ApplicationStatus.APPROVED,
          } as any,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when book uses lottery', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.LOTTERY,
      } as Book);

      await expect(
        service.bulkUpdateApplicationStatus(
          'book-1',
          'author-1',
          UserType.AUTHOR,
          {
            applicationIds: ['app-1'],
            action: ApplicationStatus.APPROVED,
          } as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when applicationIds empty or missing', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: 'author_selects' as any,
      } as Book);

      await expect(
        service.bulkUpdateApplicationStatus(
          'book-1',
          'author-1',
          UserType.AUTHOR,
          {} as any,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      await expect(
        service.bulkUpdateApplicationStatus(
          'book-1',
          'author-1',
          UserType.AUTHOR,
          {
            applicationIds: [],
          } as any,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when some applications not found or not pending', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: 'author_selects' as any,
        distributionType: 'digital',
      } as Book);
      applicationRepo.find.mockResolvedValue([]);

      await expect(
        service.bulkUpdateApplicationStatus(
          'book-1',
          'author-1',
          UserType.AUTHOR,
          {
            applicationIds: ['app-1', 'app-2'],
            action: ApplicationStatus.APPROVED,
          } as any,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates applications and sends notifications when action is approved', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: 'author_selects' as any,
        distributionType: 'digital',
        title: 'Book',
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      const apps: Application[] = [
        {
          id: 'app-1',
          readerId: 'r1',
          bookId: 'book-1',
          status: ApplicationStatus.PENDING,
        } as any,
      ];
      applicationRepo.find.mockResolvedValue(apps);
      applicationRepo.save.mockImplementation(async (a: any) => a);
      bookRepo.decrement.mockResolvedValue({} as any);
      bookRepo.save.mockResolvedValue(book);

      const result = await service.bulkUpdateApplicationStatus(
        'book-1',
        'author-1',
        UserType.AUTHOR,
        {
          applicationIds: ['app-1'],
          action: ApplicationStatus.APPROVED,
        } as any,
      );

      expect(result.updated).toBe(1);
      expect(notificationService.notifyApplicationApproved).toHaveBeenCalled();
    });
  });

  describe('markCopySent (standalone)', () => {
    it('throws NotFoundException when application not found', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markCopySent('app-1', 'author-1', UserType.AUTHOR),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when not book author', async () => {
      applicationRepo.findOne.mockResolvedValue({
        id: 'app-1',
        book: { authorId: 'other' } as any,
        status: ApplicationStatus.APPROVED as any,
      } as Application);

      await expect(
        service.markCopySent('app-1', 'author-1', UserType.AUTHOR),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when application not approved', async () => {
      applicationRepo.findOne.mockResolvedValue({
        id: 'app-1',
        book: { authorId: 'author-1' } as any,
        status: ApplicationStatus.PENDING as any,
      } as Application);

      await expect(
        service.markCopySent('app-1', 'author-1', UserType.AUTHOR),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sets copySentAt when approved', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED as any,
        book: { authorId: 'author-1' } as any,
        copySentAt: null,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.markCopySent(
        'app-1',
        'author-1',
        UserType.AUTHOR,
      );

      expect(result.copySentAt).toBeInstanceOf(Date);
    });
  });

  describe('getOverdueReviews', () => {
    it('returns applications with passed review deadline and no review', async () => {
      const apps: Application[] = [
        { id: 'app-1', readerId: 'r1', bookId: 'book-1' } as any,
      ];
      const chain = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(apps),
      };
      applicationRepo.createQueryBuilder.mockReturnValue(chain);
      reviewRepo.find.mockResolvedValue([]);

      const result = await service.getOverdueReviews('author-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('app-1');
    });

    it('filters out applications that already have a review', async () => {
      const apps: Application[] = [
        { id: 'app-1' } as any,
        { id: 'app-2' } as any,
      ];
      const chain = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(apps),
      };
      applicationRepo.createQueryBuilder.mockReturnValue(chain);
      reviewRepo.find.mockResolvedValue([{ applicationId: 'app-1' } as any]);

      const result = await service.getOverdueReviews('author-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('app-2');
    });
  });

  describe('runLotterySelection', () => {
    it('throws NotFoundException when book not found', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.runLotterySelection('book-1', 'author-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when not book author', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'other',
      } as Book);

      await expect(
        service.runLotterySelection('book-1', 'author-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when book is not lottery', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: 'author_selects' as any,
      } as Book);

      await expect(
        service.runLotterySelection('book-1', 'author-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when deadline has not passed', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.LOTTERY,
        applicationDeadline: new Date(Date.now() + 86400000),
      } as Book);

      await expect(
        service.runLotterySelection('book-1', 'author-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns zero approved/rejected when no pending applications', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.LOTTERY,
        applicationDeadline: new Date(Date.now() - 86400000),
        availableCopies: 1,
      } as Book);
      applicationRepo.find.mockResolvedValue([]);

      const result = await service.runLotterySelection('book-1', 'author-1');

      expect(result.approved).toBe(0);
      expect(result.rejected).toBe(0);
      expect(result.message).toContain('No pending');
    });

    it('throws BadRequestException when lottery already run', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.LOTTERY,
        applicationDeadline: new Date(Date.now() - 86400000),
        availableCopies: 1,
      } as Book);
      applicationRepo.find.mockResolvedValue([
        {
          id: 'app-1',
          readerId: 'r1',
          bookId: 'book-1',
          status: ApplicationStatus.PENDING,
        } as any,
      ]);
      applicationRepo.count.mockResolvedValue(1);

      await expect(
        service.runLotterySelection('book-1', 'author-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('approves winners and rejects losers', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.LOTTERY,
        applicationDeadline: new Date(Date.now() - 86400000),
        availableCopies: 1,
        distributionType: 'digital',
        title: 'Book',
        status: BookStatus.ACTIVE,
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      const pending = [
        {
          id: 'app-1',
          readerId: 'r1',
          bookId: 'book-1',
          status: ApplicationStatus.PENDING,
          appliedAt: new Date(),
        } as any,
        {
          id: 'app-2',
          readerId: 'r2',
          bookId: 'book-1',
          status: ApplicationStatus.PENDING,
          appliedAt: new Date(),
        } as any,
      ];
      applicationRepo.find.mockResolvedValue(pending);
      applicationRepo.count.mockResolvedValue(0);
      applicationRepo.update.mockResolvedValue({ affected: 1 } as any);
      bookRepo.save.mockResolvedValue(book);

      const result = await service.runLotterySelection('book-1', 'author-1');

      expect(result.approved).toBe(1);
      expect(result.rejected).toBe(1);
      expect(result.message).toContain('1 approved');
      expect(applicationRepo.update).toHaveBeenCalled();
      expect(bookRepo.save).toHaveBeenCalled();
    });
  });

  describe('bulkMarkCopySent', () => {
    it('throws NotFoundException when book not found', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.bulkMarkCopySent('book-1', 'author-1', UserType.AUTHOR, {
          applicationIds: ['app-1'],
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when not book author', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'other',
      } as Book);

      await expect(
        service.bulkMarkCopySent('book-1', 'author-1', UserType.AUTHOR, {
          applicationIds: ['app-1'],
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when some applications not found or not approved', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
      } as Book);
      applicationRepo.find.mockResolvedValue([]);

      await expect(
        service.bulkMarkCopySent('book-1', 'author-1', UserType.AUTHOR, {
          applicationIds: ['app-1'],
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates copySentAt for all approved applications', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
      } as Book);
      applicationRepo.find.mockResolvedValue([
        {
          id: 'app-1',
          readerId: 'r1',
          bookId: 'book-1',
          status: ApplicationStatus.APPROVED,
        } as any,
      ]);
      applicationRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.bulkMarkCopySent(
        'book-1',
        'author-1',
        UserType.AUTHOR,
        {
          applicationIds: ['app-1'],
        } as any,
      );

      expect(result.updated).toBe(1);
      expect(applicationRepo.update).toHaveBeenCalled();
    });
  });
});
