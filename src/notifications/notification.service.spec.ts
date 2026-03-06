import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import { Notification } from './entity/notification.entity';
import { DeviceTokenService } from './device-token.service';
import { FirebaseNotificationService } from './firebase-notification.service';
import { UserProfileService } from '../user-profile/user-profile.service';
import { NotificationTypeEnum } from './enums';
import { NotFoundException } from '@nestjs/common';
import { NotificationErrorCode } from './errors';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepository: MockRepo<Notification>;
  let deviceTokenService: jest.Mocked<DeviceTokenService>;
  let firebaseNotificationService: jest.Mocked<FirebaseNotificationService>;
  let userProfileService: jest.Mocked<UserProfileService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: createMockRepo(),
        },
        {
          provide: DeviceTokenService,
          useValue: {
            getActiveTokens: jest.fn(),
          },
        },
        {
          provide: FirebaseNotificationService,
          useValue: {
            sendNotificationToMultiple: jest.fn().mockResolvedValue({
              success: 1,
              failure: 0,
            }),
          },
        },
        {
          provide: UserProfileService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepository = module.get(getRepositoryToken(Notification));
    deviceTokenService = module.get(DeviceTokenService);
    firebaseNotificationService = module.get(FirebaseNotificationService);
    userProfileService = module.get(UserProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAndSendNotification', () => {
    const userId = 'user-1';

    it('should return null when notifications are disabled for user', async () => {
      userProfileService.getProfile.mockResolvedValue({
        notificationsEnabled: false,
      } as any);

      const result = await service.createAndSendNotification(
        userId,
        NotificationTypeEnum.FRIEND_REQUEST_RECEIVED,
        'Title',
        'Body',
      );

      expect(result).toBeNull();
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    it('should return null when type not in user preferences', async () => {
      userProfileService.getProfile.mockResolvedValue({
        notificationsEnabled: true,
        notificationPreferences: [NotificationTypeEnum.APPLICATION_APPROVED],
      } as any);

      const result = await service.createAndSendNotification(
        userId,
        NotificationTypeEnum.FRIEND_REQUEST_RECEIVED,
        'Title',
        'Body',
      );

      expect(result).toBeNull();
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    it('should create notification and send push when tokens exist', async () => {
      userProfileService.getProfile.mockResolvedValue({
        notificationsEnabled: true,
        notificationPreferences: [],
      } as any);

      const notification: Notification = {
        id: 'n1',
        userId,
        type: NotificationTypeEnum.FRIEND_REQUEST_RECEIVED,
        title: 'Title',
        body: 'Body',
        data: {},
        isRead: false,
      } as any;

      notificationRepository.create.mockReturnValue(notification);
      notificationRepository.save.mockResolvedValue(notification);
      deviceTokenService.getActiveTokens.mockResolvedValue([
        'token1',
        'token2',
      ]);

      const result = await service.createAndSendNotification(
        userId,
        NotificationTypeEnum.FRIEND_REQUEST_RECEIVED,
        'Title',
        'Body',
        { foo: 'bar' },
      );

      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: NotificationTypeEnum.FRIEND_REQUEST_RECEIVED,
          title: 'Title',
          body: 'Body',
          data: expect.objectContaining({ foo: 'bar' }),
        }),
      );
      expect(notificationRepository.save).toHaveBeenCalledWith(notification);
      expect(deviceTokenService.getActiveTokens).toHaveBeenCalledWith(userId);
      expect(
        firebaseNotificationService.sendNotificationToMultiple,
      ).toHaveBeenCalled();
      expect(result).toEqual(notification);
    });

    it('should not call firebase when no tokens', async () => {
      userProfileService.getProfile.mockResolvedValue({
        notificationsEnabled: true,
        notificationPreferences: [],
      } as any);

      const notification: Notification = {
        id: 'n1',
        userId,
        type: NotificationTypeEnum.FRIEND_REQUEST_RECEIVED,
        title: 'Title',
        body: 'Body',
        data: {},
        isRead: false,
      } as any;

      notificationRepository.create.mockReturnValue(notification);
      notificationRepository.save.mockResolvedValue(notification);
      deviceTokenService.getActiveTokens.mockResolvedValue([]);

      const result = await service.createAndSendNotification(
        userId,
        NotificationTypeEnum.FRIEND_REQUEST_RECEIVED,
        'Title',
        'Body',
      );

      expect(
        firebaseNotificationService.sendNotificationToMultiple,
      ).not.toHaveBeenCalled();
      expect(result).toEqual(notification);
    });
  });

  describe('getUserNotifications', () => {
    it('should build query and return paginated response', async () => {
      const qbMock: any = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      notificationRepository.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getUserNotifications('user-1', {
        skip: 0,
        take: 10,
        unreadOnly: true,
      });

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'notification.isRead = :isRead',
        { isRead: false },
      );
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should not filter by isRead when unreadOnly is false', async () => {
      const qbMock: any = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      notificationRepository.createQueryBuilder.mockReturnValue(qbMock);

      await service.getUserNotifications('user-1', {
        skip: 0,
        take: 20,
        unreadOnly: false,
      });

      expect(qbMock.andWhere).not.toHaveBeenCalledWith(
        'notification.isRead = :isRead',
        expect.anything(),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should count unread notifications', async () => {
      notificationRepository.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(notificationRepository.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
      expect(result).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should throw NotFoundException when notification not found', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('n1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should mark notification as read and save when unread', async () => {
      const notification: Notification = {
        id: 'n1',
        userId: 'user-1',
        isRead: false,
      } as any;

      notificationRepository.findOne.mockResolvedValue(notification);
      notificationRepository.save.mockImplementation(async (n) => n);

      const result = await service.markAsRead('n1', 'user-1');

      expect(notificationRepository.save).toHaveBeenCalled();
      expect(result.isRead).toBe(true);
      expect(result.readAt).toBeInstanceOf(Date);
    });

    it('should return notification unchanged when already read', async () => {
      const notification: Notification = {
        id: 'n1',
        userId: 'user-1',
        isRead: true,
        readAt: new Date(),
      } as any;

      notificationRepository.findOne.mockResolvedValue(notification);

      const result = await service.markAsRead('n1', 'user-1');

      expect(notificationRepository.save).not.toHaveBeenCalled();
      expect(result).toBe(notification);
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications for user', async () => {
      await service.markAllAsRead('user-1');

      expect(notificationRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', isRead: false },
        expect.objectContaining({ isRead: true }),
      );
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification by id and userId', async () => {
      await service.deleteNotification('n1', 'user-1');

      expect(notificationRepository.delete).toHaveBeenCalledWith({
        id: 'n1',
        userId: 'user-1',
      });
    });
  });

  describe('deleteAllNotifications', () => {
    it('should delete all notifications for user', async () => {
      await service.deleteAllNotifications('user-1');

      expect(notificationRepository.delete).toHaveBeenCalledWith({
        userId: 'user-1',
      });
    });
  });

  describe('notification helpers', () => {
    it('should call createAndSendNotification for friend request received', async () => {
      const spy = jest
        .spyOn(service, 'createAndSendNotification')
        .mockResolvedValue(null);

      await service.notifyFriendRequestReceived('u1', 'u2', 'Alice');

      expect(spy).toHaveBeenCalledWith(
        'u1',
        NotificationTypeEnum.FRIEND_REQUEST_RECEIVED,
        'New Friend Request',
        'Alice sent you a friend request',
        { relatedUserId: 'u2' },
      );
    });

    it('should call createAndSendNotification for application approved', async () => {
      const spy = jest
        .spyOn(service, 'createAndSendNotification')
        .mockResolvedValue(null);

      await service.notifyApplicationApproved(
        'reader',
        'book1',
        'Book',
        'app1',
      );

      expect(spy).toHaveBeenCalledWith(
        'reader',
        NotificationTypeEnum.APPLICATION_APPROVED,
        'Application Approved!',
        'Your application for "Book" has been approved',
        { bookId: 'book1', applicationId: 'app1' },
      );
    });
  });
});
