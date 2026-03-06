import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserActivityService } from './user-activity.service';
import { UserActivity } from './entity/user-activity.entity';
import { ActivityType } from './enums';
import { User } from '../users/entity';
import { UserProfileService } from '../user-profile/user-profile.service';
import { UserType } from '../users/enums';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('UserActivityService', () => {
  let service: UserActivityService;
  let userActivityRepository: MockRepo<UserActivity>;
  let userRepository: MockRepo<User>;
  let userProfileService: jest.Mocked<UserProfileService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserActivityService,
        {
          provide: getRepositoryToken(UserActivity),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepo(),
        },
        {
          provide: UserProfileService,
          useValue: {
            canViewActivity: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserActivityService>(UserActivityService);
    userActivityRepository = module.get(getRepositoryToken(UserActivity));
    userRepository = module.get(getRepositoryToken(User));
    userProfileService = module.get(UserProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createActivity', () => {
    it('should create and save activity', async () => {
      const activity: UserActivity = {
        id: 'a1',
        userId: 'u1',
        activityType: ActivityType.BOOK_APPLIED,
      } as any;

      userActivityRepository.create.mockReturnValue(activity);
      userActivityRepository.save.mockResolvedValue(activity);

      const result = await service.createActivity(
        'u1',
        ActivityType.BOOK_APPLIED,
        { foo: 'bar' },
        'b1',
        'app1',
      );

      expect(userActivityRepository.create).toHaveBeenCalledWith({
        userId: 'u1',
        activityType: ActivityType.BOOK_APPLIED,
        metadata: { foo: 'bar' },
        bookId: 'b1',
        applicationId: 'app1',
      });
      expect(userActivityRepository.save).toHaveBeenCalledWith(activity);
      expect(result).toEqual(activity);
    });
  });

  describe('getUserActivity', () => {
    it('should return activities for user', async () => {
      const activities: UserActivity[] = [{ id: 'a1', userId: 'u1' } as any];

      userActivityRepository.find.mockResolvedValue(activities);

      const result = await service.getUserActivity('u1', 10);

      expect(userActivityRepository.find).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        relations: ['book', 'application'],
        order: { createdAt: 'DESC' },
        take: 10,
      });
      expect(result).toEqual(activities);
    });
  });

  describe('getFriendsActivity', () => {
    it('should return empty array when no friends', async () => {
      const result = await service.getFriendsActivity('u1', []);
      expect(result).toEqual([]);
    });

    it('should filter activities based on canView and sanitize book info', async () => {
      const activities: UserActivity[] = [
        {
          id: 'a1',
          userId: 'friend1',
          user: { id: 'friend1' } as any,
          book: {
            id: 'b1',
            authorId: 'other-author',
            fileUrl: 'url',
            fileSize: 123,
            fileType: 'pdf',
          } as any,
          application: {
            id: 'app1',
            book: {
              id: 'b2',
              authorId: 'other-author',
              fileUrl: 'url2',
              fileSize: 456,
              fileType: 'epub',
            } as any,
          } as any,
        } as any,
      ];

      userActivityRepository.find.mockResolvedValue(activities);
      userProfileService.canViewActivity.mockResolvedValue({
        canView: true,
      } as any);

      const result = await service.getFriendsActivity(
        'u1',
        ['friend1'],
        10,
        UserType.READER,
      );

      expect(userActivityRepository.find).toHaveBeenCalledWith({
        where: { userId: In(['friend1']) },
        relations: ['user', 'book', 'application', 'application.book'],
        order: { createdAt: 'DESC' },
        take: 20,
      });
      expect(result).toHaveLength(1);
      expect(result[0].book?.fileUrl).toBeUndefined();
      expect(result[0].application?.book?.fileUrl).toBeUndefined();
    });
  });

  describe('getPublicActivity', () => {
    it('should build query with public types filter', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      userActivityRepository.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getPublicActivity('u1', 5);

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'activity.activityType IN (:...publicTypes)',
        { publicTypes: ['book_published', 'review_posted'] },
      );
      expect(result).toEqual([]);
    });
  });

  describe('getActivityByType', () => {
    it('should find by user and activityType', async () => {
      const activities: UserActivity[] = [{ id: 'a1' } as any];
      userActivityRepository.find.mockResolvedValue(activities);

      const result = await service.getActivityByType(
        'u1',
        ActivityType.BOOK_APPLIED,
        10,
      );

      expect(userActivityRepository.find).toHaveBeenCalledWith({
        where: { userId: 'u1', activityType: ActivityType.BOOK_APPLIED },
        relations: ['book', 'application'],
        order: { createdAt: 'DESC' },
        take: 10,
      });
      expect(result).toEqual(activities);
    });
  });

  describe('getRecentActivity', () => {
    it('should build query with date filter', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      userActivityRepository.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getRecentActivity('u1', 7, 20);

      expect(qbMock.where).toHaveBeenCalledWith('activity.userId = :userId', {
        userId: 'u1',
      });
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'activity.createdAt >= :startDate',
        expect.any(Object),
      );
      expect(result).toEqual([]);
    });
  });

  describe('getRecentPublicActivity', () => {
    it('should build query with date and publicTypes filter', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      userActivityRepository.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getRecentPublicActivity('u1', 7, 20);

      expect(qbMock.andWhere).toHaveBeenNthCalledWith(
        1,
        'activity.createdAt >= :startDate',
        expect.any(Object),
      );
      expect(qbMock.andWhere).toHaveBeenNthCalledWith(
        2,
        'activity.activityType IN (:...publicTypes)',
        { publicTypes: ['book_published', 'review_posted'] },
      );
      expect(result).toEqual([]);
    });
  });

  describe('getActivityStats', () => {
    it('should aggregate total, byType and lastActivity', async () => {
      userActivityRepository.count.mockResolvedValue(3);

      const qbMock: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { type: ActivityType.BOOK_APPLIED, count: '2' },
          { type: ActivityType.REVIEW_POSTED, count: '1' },
        ]),
      };

      const lastActivity: UserActivity = {
        id: 'a3',
        userId: 'u1',
        activityType: ActivityType.BOOK_APPLIED,
        createdAt: new Date(),
      } as any;

      userActivityRepository.createQueryBuilder.mockReturnValue(qbMock);
      userActivityRepository.findOne.mockResolvedValue(lastActivity);

      const stats = await service.getActivityStats('u1');

      expect(stats.totalActivities).toBe(3);
      expect(stats.activitiesByType[ActivityType.BOOK_APPLIED]).toBe(2);
      expect(stats.activitiesByType[ActivityType.REVIEW_POSTED]).toBe(1);
      expect(stats.lastActivity).toEqual(lastActivity.createdAt);
    });
  });

  describe('log helpers', () => {
    it('should call createActivity for logBookApplied', async () => {
      const spy = jest
        .spyOn(service, 'createActivity')
        .mockResolvedValue({} as UserActivity);

      await service.logBookApplied('u1', 'b1', 'app1');

      expect(spy).toHaveBeenCalledWith(
        'u1',
        ActivityType.BOOK_APPLIED,
        { bookId: 'b1' },
        'b1',
        'app1',
      );
    });

    it('should call createActivity for logProfileUpdated', async () => {
      const spy = jest
        .spyOn(service, 'createActivity')
        .mockResolvedValue({} as UserActivity);

      await service.logProfileUpdated('u1', ['name', 'bio']);

      expect(spy).toHaveBeenCalledWith('u1', ActivityType.PROFILE_UPDATED, {
        changes: ['name', 'bio'],
      });
    });
  });
});
