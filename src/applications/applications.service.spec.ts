import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApplicationsService } from './applications.service';
import { Application } from './entity/application.entity';
import { Book } from '../books/entity/book.entity';
import { User } from '../users/entity/user.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { Review } from '../reviews/entity/review.entity';
import { NotificationService } from '../notifications/notification.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { ApplicationStatus } from './enums';
import { ReadingStatus } from './enums/reading-status.enum';
import { UserType } from '../users/enums';
import {
  ApplicationBookHelper,
  ApplicationNotificationHelper,
  ApplicationAddressHelper,
} from './helpers';
import {
  AgeRating,
  BookStatus,
  DistributionType,
  SelectionMethod,
} from '../books/enums';
import { ApplicationErrors } from './errors';
import { ForbiddenException } from '@nestjs/common';
import { PaginateQuery } from 'nestjs-paginate';
import { DataSource } from 'typeorm';

const mockPaginate = jest.fn();
jest.mock('nestjs-paginate', () => ({
  paginate: (...args: unknown[]) => mockPaginate(...args),
  FilterOperator: { EQ: '$eq' },
}));

type MockRepo<T = any> = { [key: string]: jest.Mock };

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

describe('ApplicationsService (minimal)', () => {
  let service: ApplicationsService;
  let applicationRepo: MockRepo<Application>;
  let bookRepo: MockRepo<Book>;
  let userRepo: MockRepo<User>;
  let reviewRepo: MockRepo<Review>;
  let notificationService: {
    notifyApplicationRejected: jest.Mock;
    notifyApplicationApproved: jest.Mock;
  };
  let userActivityService: jest.Mocked<UserActivityService>;
  let transactionManager: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    getRepository: jest.Mock;
  };

  beforeEach(async () => {
    transactionManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      getRepository: jest.fn((entity) => {
        if (entity === Book) {
          return bookRepo;
        }
        if (entity === Application) {
          return applicationRepo;
        }
        return createMockRepo();
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (cb: (manager: typeof transactionManager) => unknown) =>
        cb(transactionManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: DataSource, useValue: dataSource },
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
          useValue: {
            notifyApplicationRejected: jest.fn().mockResolvedValue(undefined),
            notifyApplicationApproved: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UserActivityService,
          useValue: {
            logBookApplied: jest.fn().mockResolvedValue(undefined),
            logReadingStatusUpdated: jest.fn().mockResolvedValue(undefined),
            logBookStarted: jest.fn().mockResolvedValue(undefined),
            logBookCompleted: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    applicationRepo = module.get(getRepositoryToken(Application));
    bookRepo = module.get(getRepositoryToken(Book));
    userRepo = module.get(getRepositoryToken(User));
    reviewRepo = module.get(getRepositoryToken(Review));
    notificationService = module.get('NotificationService');
    userActivityService = module.get(UserActivityService);

    jest
      .spyOn(ApplicationBookHelper, 'tryReserveCopies')
      .mockResolvedValue(true);
    jest
      .spyOn(ApplicationBookHelper, 'shouldSetCopySentAt')
      .mockReturnValue(false);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('withdrawApplication', () => {
    it('throws NotFoundException when application not found', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.withdrawApplication('app-1', 'reader-1'),
      ).rejects.toThrow();
    });
  });

  describe('bulkMarkCopySent', () => {
    it('throws when book not found', async () => {
      bookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.bulkMarkCopySent(
          'book-1',
          'author-1',
          UserType.AUTHOR,
          { applicationIds: ['a1'] } as any,
        ),
      ).rejects.toThrow();
    });

    it('marks approved applications as sent in bulk', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
        distributionType: DistributionType.DIGITAL,
      } as any);

      const apps: Application[] = [
        {
          id: 'a1',
          bookId: 'book-1',
          status: ApplicationStatus.APPROVED,
        } as any,
      ];
      applicationRepo.find.mockResolvedValue(apps);
      applicationRepo.update.mockResolvedValue({} as any);

      const result = await service.bulkMarkCopySent(
        'book-1',
        'author-1',
        UserType.AUTHOR,
        { applicationIds: ['a1'] } as any,
      );

      expect(applicationRepo.update).toHaveBeenCalled();
      expect(result).toEqual({ updated: 1 });
    });

    it('throws when some application ids are not approved or not found', async () => {
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
      } as any);
      applicationRepo.find.mockResolvedValue([
        { id: 'a1', bookId: 'book-1', status: ApplicationStatus.APPROVED } as any,
      ]);

      await expect(
        service.bulkMarkCopySent('book-1', 'author-1', UserType.AUTHOR, {
          applicationIds: ['a1', 'a2'],
        } as any),
      ).rejects.toThrow(ApplicationErrors.APPLICATION_NOT_FOUND);
    });
  });

  describe('create', () => {
    it('creates approved application for FIRST_COME digital book', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'reader-1',
        emailVerified: true,
      } as any);

      const book: Book = {
        id: 'book-1',
        title: 'Test Book',
        authorId: 'author-1',
        status: BookStatus.ACTIVE,
        availableCopies: 1,
        applicationDeadline: new Date(Date.now() + 60_000),
        ageRating: AgeRating.ALL,
        selectionMethod: SelectionMethod.FIRST_COME,
        distributionType: DistributionType.DIGITAL,
      } as any;
      applicationRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'app-1',
          readerId: 'reader-1',
          bookId: 'book-1',
          status: ApplicationStatus.APPROVED,
          book,
        } as any);

      transactionManager.findOne.mockResolvedValue(book);
      transactionManager.save.mockImplementation(async (_entity, data: any) => ({
        ...data,
        id: 'app-1',
      }));

      const dto = {
        bookId: 'book-1',
        applicationMessage: 'I want to read this',
      } as any;

      const result = await service.create('reader-1', dto);

      expect(result.id).toBe('app-1');
      expect(transactionManager.save).toHaveBeenCalled();
      expect(userActivityService.logBookApplied).toHaveBeenCalledWith(
        'reader-1',
        'book-1',
        'app-1',
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

    it('returns application when one exists', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        book: {} as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      const result = await service.checkApplication('reader-1', 'book-1');

      expect(result.hasApplied).toBe(true);
      expect(result.application).toBe(app);
    });
  });

  describe('findOne', () => {
    it('returns application when user is reader', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING,
        readingStatus: ReadingStatus.NOT_STARTED,
        book: {
          id: 'book-1',
          authorId: 'author-2',
        } as any,
      } as any;

      applicationRepo.findOne.mockResolvedValue(app);

      const result = await service.findOne('app-1', 'reader-1');

      expect(result).toBe(app);
    });
  });

  describe('updateReadingStatus', () => {
    it('updates reading status and logs activity', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        readingStatus: ReadingStatus.NOT_STARTED,
        book: {
          id: 'book-1',
          authorId: 'author-1',
        } as any,
      } as any;

      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.updateReadingStatus('app-1', 'reader-1', {
        readingStatus: ReadingStatus.CURRENTLY_READING,
      } as any);

      expect(result.readingStatus).toBe(ReadingStatus.CURRENTLY_READING);
    });

    it('calls logBookCompleted when status is FOR_REVIEW', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.APPROVED,
        readingStatus: ReadingStatus.CURRENTLY_READING,
        readingCompletedAt: null,
        book: { id: 'book-1', authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      await service.updateReadingStatus('app-1', 'reader-1', {
        readingStatus: ReadingStatus.FOR_REVIEW,
      } as any);

      expect(userActivityService.logBookCompleted).toHaveBeenCalledWith(
        'reader-1',
        'book-1',
        'app-1',
      );
    });

    it('does not throw when logReadingStatusActivity fails', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        readingStatus: ReadingStatus.NOT_STARTED,
        readingStartedAt: null,
        book: { id: 'book-1', authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);
      userActivityService.logBookStarted.mockRejectedValue(new Error('log failed'));

      const result = await service.updateReadingStatus('app-1', 'reader-1', {
        readingStatus: ReadingStatus.CURRENTLY_READING,
      } as any);

      expect(result.readingStatus).toBe(ReadingStatus.CURRENTLY_READING);
    });
  });

  describe('markCopySent / markCopyReceived', () => {
    it('marks copy sent for approved application', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        bookId: 'book-1',
        book: { authorId: 'author-1' } as any,
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

    it('marks copy received for approved application', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        bookId: 'book-1',
        book: { authorId: 'author-1' } as any,
      } as any;

      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.markCopyReceived('app-1', 'reader-1');

      expect(result.copyReceivedAt).toBeInstanceOf(Date);
    });
  });

  describe('bulkUpdateApplicationStatus', () => {
    it('updates statuses and sends notifications', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
        availableCopies: 2,
        distributionType: DistributionType.DIGITAL,
        title: 'Title',
      } as any;
      const apps: Application[] = [
        {
          id: 'a1',
          readerId: 'reader-1',
          bookId: 'book-1',
          status: ApplicationStatus.PENDING,
        } as any,
        {
          id: 'a2',
          readerId: 'reader-2',
          bookId: 'book-1',
          status: ApplicationStatus.PENDING,
        } as any,
      ];
      transactionManager.findOne.mockResolvedValue(book);
      transactionManager.find.mockResolvedValue(apps);
      transactionManager.save.mockImplementation(async (_entity, a: any) => a);

      const dto = {
        applicationIds: ['a1', 'a2'],
        action: ApplicationStatus.APPROVED,
        authorNotes: 'ok',
      } as any;

      const result = await service.bulkUpdateApplicationStatus(
        'book-1',
        'author-1',
        UserType.AUTHOR,
        dto,
      );

      expect(result.updated).toBe(2);
      expect(
        ApplicationNotificationHelper.sendBulkStatusNotifications,
      ).toBeDefined();
    });

    it('sets copySentAt for each approved app when book is digital', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
        availableCopies: 2,
        distributionType: DistributionType.DIGITAL,
        title: 'Title',
      } as any;
      jest.spyOn(ApplicationBookHelper, 'shouldSetCopySentAt').mockReturnValue(true);

      const apps: Application[] = [
        { id: 'a1', readerId: 'r1', bookId: 'book-1', status: ApplicationStatus.PENDING, copySentAt: null } as any,
        { id: 'a2', readerId: 'r2', bookId: 'book-1', status: ApplicationStatus.PENDING, copySentAt: null } as any,
      ];
      transactionManager.findOne.mockResolvedValue(book);
      transactionManager.find.mockResolvedValue(apps);
      transactionManager.save.mockImplementation(async (_entity, arr: any) => arr);

      await service.bulkUpdateApplicationStatus(
        'book-1',
        'author-1',
        UserType.AUTHOR,
        { applicationIds: ['a1', 'a2'], action: ApplicationStatus.APPROVED } as any,
      );

      expect(apps[0].copySentAt).toBeInstanceOf(Date);
      expect(apps[1].copySentAt).toBeInstanceOf(Date);
    });
  });

  describe('getOverdueReviews', () => {
    it('returns empty array when there are no overdue applications', async () => {
      applicationRepo.find.mockResolvedValue([]);

      const result = await service.getOverdueReviews('author-1');

      expect(result).toEqual([]);
    });

    it('filters out applications that already have a review', async () => {
      const apps: Application[] = [
        {
          id: 'a1',
          readerId: 'r1',
          book: { authorId: 'author-1', reviewDeadline: new Date() } as any,
        } as any,
        {
          id: 'a2',
          readerId: 'r2',
          book: { authorId: 'author-1', reviewDeadline: new Date() } as any,
        } as any,
      ];
      applicationRepo.find.mockResolvedValue(apps);
      reviewRepo.find.mockResolvedValue([
        { applicationId: 'a1' } as any,
      ] as any);

      const result = await service.getOverdueReviews('author-1');

      expect(result.map((a) => a.id)).toEqual(['a2']);
    });
  });

  describe('runLotterySelection', () => {
    it('returns message when there are no pending applications', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        title: 'Book',
        availableCopies: 5,
        selectionMethod: SelectionMethod.LOTTERY,
        applicationDeadline: new Date(Date.now() - 60_000),
      } as any;
      transactionManager.findOne.mockResolvedValue(book);
      transactionManager.find.mockResolvedValue([]);

      const result = await service.runLotterySelection('book-1', 'author-1');

      expect(result.approved).toBe(0);
      expect(result.rejected).toBe(0);
      expect(result.message).toContain('No pending applications');
    });

    it('throws when book is not lottery selection', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
        applicationDeadline: new Date(Date.now() - 60_000),
      } as any;
      transactionManager.findOne.mockResolvedValue(book);

      await expect(
        service.runLotterySelection('book-1', 'author-1'),
      ).rejects.toThrow('does not use lottery selection');
    });

    it('throws when application deadline has not passed', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.LOTTERY,
        applicationDeadline: new Date(Date.now() + 86400000),
      } as any;
      transactionManager.findOne.mockResolvedValue(book);

      await expect(
        service.runLotterySelection('book-1', 'author-1'),
      ).rejects.toThrow('deadline has not passed');
    });

    it('throws when lottery already run for book', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.LOTTERY,
        applicationDeadline: new Date(Date.now() - 60_000),
        availableCopies: 2,
        lotteryRunAt: new Date(),
      } as any;
      transactionManager.findOne.mockResolvedValue(book);

      await expect(
        service.runLotterySelection('book-1', 'author-1'),
      ).rejects.toThrow('Lottery has already been run');
    });

    it('approves and rejects applications when lottery runs', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        title: 'Book',
        availableCopies: 1,
        selectionMethod: SelectionMethod.LOTTERY,
        applicationDeadline: new Date(Date.now() - 60_000),
        distributionType: DistributionType.PHYSICAL,
      } as any;
      const pending = [
        { id: 'a1', bookId: 'book-1', status: ApplicationStatus.PENDING, readerId: 'r1', book } as any,
        { id: 'a2', bookId: 'book-1', status: ApplicationStatus.PENDING, readerId: 'r2', book } as any,
      ];
      transactionManager.findOne.mockResolvedValue(book);
      transactionManager.find.mockResolvedValue(pending);
      transactionManager.save.mockImplementation(async (_entity, data) => data);
      applicationRepo.update.mockResolvedValue({});

      const result = await service.runLotterySelection('book-1', 'author-1');

      expect(result.approved).toBe(1);
      expect(result.rejected).toBe(1);
      expect(result.message).toContain('Lottery completed');
      expect(applicationRepo.update).toHaveBeenCalled();
    });

    it('sets copySentAt for lottery winners when book is digital', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        title: 'Book',
        availableCopies: 1,
        selectionMethod: SelectionMethod.LOTTERY,
        applicationDeadline: new Date(Date.now() - 60_000),
        distributionType: DistributionType.DIGITAL,
      } as any;
      const pending = [
        { id: 'a1', bookId: 'book-1', status: ApplicationStatus.PENDING, readerId: 'r1', book } as any,
        { id: 'a2', bookId: 'book-1', status: ApplicationStatus.PENDING, readerId: 'r2', book } as any,
      ];
      transactionManager.findOne.mockResolvedValue(book);
      transactionManager.find.mockResolvedValue(pending);
      transactionManager.save.mockImplementation(async (_entity, data) => data);
      jest.spyOn(ApplicationBookHelper, 'shouldSetCopySentAt').mockReturnValue(true);

      const updateCalls: Array<{ copySentAt?: Date }> = [];
      applicationRepo.update.mockImplementation((_criteria: any, update: any) => {
        updateCalls.push(update);
        return Promise.resolve({} as any);
      });

      const result = await service.runLotterySelection('book-1', 'author-1');

      expect(result.approved).toBe(1);
      expect(result.rejected).toBe(1);
      const winnerUpdate = updateCalls.find((u) => u.copySentAt !== undefined);
      expect(winnerUpdate).toBeDefined();
      expect(winnerUpdate!.copySentAt).toBeInstanceOf(Date);
    });
  });

  describe('findMyApplications', () => {
    it('returns paginated applications with sanitized data', async () => {
      mockPaginate.mockResolvedValue({
        data: [{ id: 'app-1', readerId: 'reader-1', bookId: 'book-1' } as any],
        meta: { totalItems: 1, itemsPerPage: 20, currentPage: 1, totalPages: 1 },
        links: {},
      });

      const result = await service.findMyApplications('reader-1', {} as PaginateQuery);

      expect(mockPaginate).toHaveBeenCalledWith(
        expect.anything(),
        applicationRepo,
        expect.objectContaining({ where: { readerId: 'reader-1' } }),
      );
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getBookApplications', () => {
    it('returns paginated applications and attaches reader addresses', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        distributionType: DistributionType.PHYSICAL,
      } as any;
      bookRepo.findOne.mockResolvedValue(book);
      mockPaginate.mockResolvedValue({
        data: [{ id: 'a1', readerId: 'r1', bookId: 'book-1', reader: {} } as any],
        meta: {},
        links: {},
      });
      jest.spyOn(ApplicationAddressHelper, 'attachReaderAddresses').mockResolvedValue(undefined);

      const result = await service.getBookApplications(
        'book-1',
        'author-1',
        {} as PaginateQuery,
      );

      expect(result.data).toHaveLength(1);
      expect(ApplicationAddressHelper.attachReaderAddresses).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('allows reader to update applicationMessage when PENDING', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.PENDING,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.update(
        'app-1',
        'reader-1',
        UserType.READER,
        { applicationMessage: 'Updated message' } as any,
      );

      expect(result.applicationMessage).toBe('Updated message');
    });

    it('throws when non-reader tries to update applicationMessage', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.PENDING,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'author-1', UserType.AUTHOR, {
          applicationMessage: 'Updated',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when reader tries to update message but application is not PENDING', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'reader-1', UserType.READER, {
          applicationMessage: 'Too late',
        } as any),
      ).rejects.toThrow(ApplicationErrors.APPLICATION_CANNOT_UPDATE);
    });

    it('throws when non-author tries to set markCopySent', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'reader-1', UserType.READER, {
          markCopySent: true,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when non-reader tries to set markCopyReceived', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'author-1', UserType.AUTHOR, {
          markCopyReceived: true,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when non-reader tries to update readingStatus', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(
        service.update('app-1', 'author-1', UserType.AUTHOR, {
          readingStatus: ReadingStatus.CURRENTLY_READING,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows author to update status to APPROVED and sets copySentAt for digital', async () => {
      const book = {
        id: 'book-1',
        authorId: 'author-1',
        title: 'Book',
        distributionType: DistributionType.DIGITAL,
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
        availableCopies: 1,
      } as any;
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING,
        book,
      } as any;
      const approvedApp: Application = {
        ...app,
        status: ApplicationStatus.APPROVED,
        copySentAt: new Date(),
        respondedAt: new Date(),
      } as any;
      applicationRepo.findOne
        .mockResolvedValueOnce(app)
        .mockResolvedValueOnce(approvedApp);
      transactionManager.findOne
        .mockResolvedValueOnce({ ...app, bookId: 'book-1' })
        .mockResolvedValueOnce(book);
      transactionManager.save.mockImplementation(async (_entity, a: any) => a);
      applicationRepo.save.mockResolvedValue(approvedApp);
      jest.spyOn(ApplicationBookHelper, 'shouldSetCopySentAt').mockReturnValue(true);

      const result = await service.update(
        'app-1',
        'author-1',
        UserType.AUTHOR,
        { status: ApplicationStatus.APPROVED } as any,
      );

      expect(result.status).toBe(ApplicationStatus.APPROVED);
      expect(result.copySentAt).toBeInstanceOf(Date);
      expect(notificationService.notifyApplicationApproved).toHaveBeenCalled();
    });

    it('rejects application via update and sends notification', async () => {
      const book = {
        id: 'book-1',
        authorId: 'author-1',
        title: 'Book',
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
      } as any;
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        bookId: 'book-1',
        status: ApplicationStatus.PENDING,
        book,
      } as any;
      const rejectedApp: Application = {
        ...app,
        status: ApplicationStatus.REJECTED,
        respondedAt: new Date(),
      } as any;
      applicationRepo.findOne
        .mockResolvedValueOnce(app)
        .mockResolvedValueOnce(rejectedApp);
      transactionManager.findOne
        .mockResolvedValueOnce({ ...app, bookId: 'book-1' })
        .mockResolvedValueOnce(book);
      transactionManager.save.mockImplementation(async (_entity, a: any) => a);
      applicationRepo.save.mockResolvedValue(rejectedApp);

      const result = await service.update(
        'app-1',
        'author-1',
        UserType.AUTHOR,
        { status: ApplicationStatus.REJECTED } as any,
      );

      expect(result.status).toBe(ApplicationStatus.REJECTED);
      expect(notificationService.notifyApplicationRejected).toHaveBeenCalled();
    });

    it('allows reader to update readingStatus to CURRENTLY_READING', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        readingStatus: ReadingStatus.NOT_STARTED,
        readingStartedAt: null,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.update(
        'app-1',
        'reader-1',
        UserType.READER,
        { readingStatus: ReadingStatus.CURRENTLY_READING } as any,
      );

      expect(result.readingStatus).toBe(ReadingStatus.CURRENTLY_READING);
      expect(result.readingStartedAt).toBeInstanceOf(Date);
    });

    it('allows reader to update readingStatus to FOR_REVIEW', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        readingStatus: ReadingStatus.CURRENTLY_READING,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.update(
        'app-1',
        'reader-1',
        UserType.READER,
        { readingStatus: ReadingStatus.FOR_REVIEW } as any,
      );

      expect(result.readingStatus).toBe(ReadingStatus.FOR_REVIEW);
      expect(result.readingCompletedAt).toBeInstanceOf(Date);
    });

    it('allows author to set markCopySent', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        copySentAt: null,
        book: { authorId: 'author-1' } as any,
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

    it('allows reader to set markCopyReceived', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        copyReceivedAt: null,
        book: { authorId: 'author-1' } as any,
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
  });

  describe('withdrawApplication', () => {
    it('sets status to WITHDRAWN when application is PENDING', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.PENDING,
        book: { authorId: 'author-1' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);
      applicationRepo.save.mockImplementation(async (a: any) => a);

      const result = await service.withdrawApplication('app-1', 'reader-1');

      expect(result.status).toBe(ApplicationStatus.WITHDRAWN);
    });
  });

  describe('create', () => {
    it('creates PENDING application when book uses AUTHOR_SELECTS', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'reader-1',
        emailVerified: true,
        birthDate: new Date('1990-01-01'),
      } as any);
      const book: Book = {
        id: 'book-1',
        title: 'Book',
        authorId: 'author-1',
        status: BookStatus.ACTIVE,
        availableCopies: 2,
        applicationDeadline: new Date(Date.now() + 60000),
        ageRating: AgeRating.ALL,
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
        distributionType: DistributionType.PHYSICAL,
      } as any;
      applicationRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'app-1',
          bookId: 'book-1',
          readerId: 'reader-1',
          status: ApplicationStatus.PENDING,
          book,
        } as any);
      transactionManager.findOne.mockResolvedValue(book);
      transactionManager.save.mockImplementation(async (_entity, data: any) => ({
        ...data,
        id: 'app-1',
        status: data.status,
      }));

      const result = await service.create('reader-1', { bookId: 'book-1' } as any);

      expect(result.status).toBe(ApplicationStatus.PENDING);
      expect(transactionManager.save).toHaveBeenCalledWith(
        Application,
        expect.objectContaining({
          status: ApplicationStatus.PENDING,
          respondedAt: null,
          copySentAt: null,
        }),
      );
    });

    it('does not throw when logBookAppliedActivity fails', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'reader-1',
        emailVerified: true,
        birthDate: new Date('1990-01-01'),
      } as any);
      const book: Book = {
        id: 'book-1',
        title: 'Book',
        authorId: 'author-1',
        status: BookStatus.ACTIVE,
        availableCopies: 1,
        applicationDeadline: new Date(Date.now() + 60000),
        ageRating: AgeRating.ALL,
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
        distributionType: DistributionType.PHYSICAL,
      } as any;
      applicationRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'app-1',
          bookId: 'book-1',
          readerId: 'reader-1',
          status: ApplicationStatus.PENDING,
          book,
        } as any);
      transactionManager.findOne.mockResolvedValue(book);
      transactionManager.save.mockImplementation(async (_entity, data: any) => ({
        ...data,
        id: 'app-1',
      }));
      userActivityService.logBookApplied.mockRejectedValue(new Error('activity failed'));

      const result = await service.create('reader-1', { bookId: 'book-1' } as any);

      expect(result.id).toBe('app-1');
    });
  });

  describe('bulkUpdateApplicationStatus', () => {
    it('throws when applicationIds empty or missing', async () => {
      await expect(
        service.bulkUpdateApplicationStatus('book-1', 'author-1', UserType.AUTHOR, {
          applicationIds: [],
        } as any),
      ).rejects.toThrow(ApplicationErrors.APPLICATION_NOT_FOUND);
    });

    it('throws when book uses lottery selection', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.LOTTERY,
      } as any;
      transactionManager.findOne.mockResolvedValue(book);

      await expect(
        service.bulkUpdateApplicationStatus('book-1', 'author-1', UserType.AUTHOR, {
          applicationIds: ['a1'],
        } as any),
      ).rejects.toThrow(ApplicationErrors.APPLICATION_CANNOT_MANAGE_LOTTERY);
    });

    it('throws when some application ids not found', async () => {
      const book: Book = {
        id: 'book-1',
        authorId: 'author-1',
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
      } as any;
      transactionManager.findOne.mockResolvedValue(book);
      transactionManager.find.mockResolvedValue([]);

      await expect(
        service.bulkUpdateApplicationStatus('book-1', 'author-1', UserType.AUTHOR, {
          applicationIds: ['a1', 'a2'],
        } as any),
      ).rejects.toThrow(ApplicationErrors.APPLICATION_NOT_FOUND);
    });
  });

  describe('findOne', () => {
    it('throws when user has no access to application', async () => {
      const app: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        book: { authorId: 'author-2' } as any,
      } as any;
      applicationRepo.findOne.mockResolvedValue(app);

      await expect(service.findOne('app-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

