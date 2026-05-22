import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FriendsService } from './friends.service';
import { Friend } from './entity/friend.entity';
import { User } from '../users/entity/user.entity';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FriendStatus, FriendRequestType, FriendsListSortBy } from './enums';
import { UserType } from '../users/enums';
import { FriendErrorCode } from './errors';
import { sanitizeUserPublic } from '../common/utils/user-sanitizer.util';
import { UserActivityService } from '../user-activity/user-activity.service';
import {
  FriendsListHelper,
  FriendsNotificationsHelper,
  FriendsQueryHelper,
  FriendsSearchHelper,
} from './helpers';

jest.mock('../common/utils/user-sanitizer.util', () => ({
  sanitizeUserPublic: jest.fn((u) => u),
}));

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('FriendsService', () => {
  let service: FriendsService;
  let friendRepository: MockRepo<Friend>;
  let userRepository: MockRepo<User>;
  let notificationService: {
    notifyFriendRequestReceived: jest.Mock;
    notifyFriendRequestAccepted: jest.Mock;
    notifyYouAcceptedFriendRequest: jest.Mock;
    notifyFriendRequestDeclined: jest.Mock;
    notifyYouDeclinedFriendRequest: jest.Mock;
  };
  let userActivityService: jest.Mocked<UserActivityService>;

  beforeEach(async () => {
    notificationService = {
      notifyFriendRequestReceived: jest.fn().mockResolvedValue(true),
      notifyFriendRequestAccepted: jest.fn().mockResolvedValue(true),
      notifyYouAcceptedFriendRequest: jest.fn().mockResolvedValue(true),
      notifyFriendRequestDeclined: jest.fn().mockResolvedValue(true),
      notifyYouDeclinedFriendRequest: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        FriendsQueryHelper,
        FriendsListHelper,
        FriendsSearchHelper,
        FriendsNotificationsHelper,
        {
          provide: getRepositoryToken(Friend),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepo(),
        },
        {
          provide: 'NotificationService',
          useValue: notificationService,
        },
        {
          provide: UserActivityService,
          useValue: {
            getActivityStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
    friendRepository = module.get(getRepositoryToken(Friend));
    userRepository = module.get(getRepositoryToken(User));
    userActivityService = module.get(UserActivityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendFriendRequest', () => {
    it('should throw BadRequestException when trying to friend self', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
      } as User);

      await expect(
        service.sendFriendRequest('user-1', 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw BadRequestException when requester is author', async () => {
      await expect(
        service.sendFriendRequest('user-1', 'other', UserType.AUTHOR),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw NotFoundException when addressee not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.sendFriendRequest('user-1', 'other'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'other' },
      });
    });

    it('should throw ConflictException when already friends', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-2',
      } as User);
      friendRepository.findOne.mockResolvedValue({
        id: 'friend-1',
        status: FriendStatus.ACCEPTED,
      } as Friend);

      await expect(
        service.sendFriendRequest('user-1', 'other'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should throw ConflictException when request already pending', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-2',
      } as User);
      friendRepository.findOne.mockResolvedValue({
        id: 'friend-1',
        status: FriendStatus.PENDING,
      } as Friend);

      await expect(
        service.sendFriendRequest('user-1', 'other'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should create and save friend request when valid', async () => {
      const addressee: User = {
        id: 'user-2',
        firstName: 'John',
        lastName: 'Doe',
      } as any;

      userRepository.findOne.mockResolvedValue(addressee);
      friendRepository.findOne.mockResolvedValue(null);

      const friendRequest: Friend = {
        id: 'friend-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: FriendStatus.PENDING,
      } as any;

      friendRepository.create.mockReturnValue(friendRequest);
      friendRepository.save.mockResolvedValue(friendRequest);

      const result = await service.sendFriendRequest('user-1', 'other');

      expect(friendRepository.create).toHaveBeenCalledWith({
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: FriendStatus.PENDING,
      });
      expect(friendRepository.save).toHaveBeenCalledWith(friendRequest);
      expect(result).toEqual(friendRequest);
    });
  });

  describe('acceptFriendRequest', () => {
    it('should throw NotFoundException when request not found', async () => {
      friendRepository.findOne.mockResolvedValue(null);

      await expect(
        service.acceptFriendRequest('user-2', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should accept request and save', async () => {
      const friendRequest: Friend = {
        id: 'friend-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: FriendStatus.PENDING,
      } as any;

      friendRepository.findOne.mockResolvedValue(friendRequest);
      friendRepository.save.mockImplementation(async (f) => f);

      const result = await service.acceptFriendRequest('user-2', 'user-1');

      expect(friendRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(FriendStatus.ACCEPTED);
    });
  });

  describe('declineFriendRequest', () => {
    it('should throw NotFoundException when request not found', async () => {
      friendRepository.findOne.mockResolvedValue(null);

      await expect(
        service.declineFriendRequest('user-2', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should remove friend request when found', async () => {
      const friendRequest: Friend = {
        id: 'friend-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: FriendStatus.PENDING,
      } as any;

      friendRepository.findOne.mockResolvedValue(friendRequest);
      friendRepository.remove.mockResolvedValue(friendRequest);

      await service.declineFriendRequest('user-2', 'user-1');

      expect(friendRepository.remove).toHaveBeenCalledWith(friendRequest);
    });
  });

  describe('unfriend', () => {
    it('should throw NotFoundException when friendship not found', async () => {
      friendRepository.findOne.mockResolvedValue(null);

      await expect(service.unfriend('user-1', 'user-2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should remove friendship when found', async () => {
      const friendship: Friend = {
        id: 'friend-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: FriendStatus.ACCEPTED,
      } as any;

      friendRepository.findOne.mockResolvedValue(friendship);
      friendRepository.remove.mockResolvedValue(friendship);

      await service.unfriend('user-1', 'user-2');

      expect(friendRepository.remove).toHaveBeenCalledWith(friendship);
    });
  });

  describe('getPendingFriendRequests', () => {
    it('should get received requests by default', async () => {
      friendRepository.find.mockResolvedValue([]);

      await service.getPendingFriendRequests('user-1');

      expect(friendRepository.find).toHaveBeenCalledWith({
        where: { addresseeId: 'user-1', status: FriendStatus.PENDING },
        relations: ['requester'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should get sent requests when type is sent', async () => {
      friendRepository.find.mockResolvedValue([]);

      await service.getPendingFriendRequests('user-1', FriendRequestType.SENT);

      expect(friendRepository.find).toHaveBeenCalledWith({
        where: { requesterId: 'user-1', status: FriendStatus.PENDING },
        relations: ['addressee'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getFriendshipStatus', () => {
    it('should return null status when no friendship', async () => {
      friendRepository.findOne.mockResolvedValue(null);

      const result = await service.getFriendshipStatus('user-1', 'user-2');
      expect(result).toEqual({ status: null, isRequester: false });
    });

    it('should return status and isRequester correctly', async () => {
      const friendship: Friend = {
        id: 'friend-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: FriendStatus.ACCEPTED,
      } as any;

      friendRepository.findOne.mockResolvedValue(friendship);

      const result = await service.getFriendshipStatus('user-1', 'user-2');
      expect(result).toEqual({
        status: FriendStatus.ACCEPTED,
        isRequester: true,
      });
    });
  });

  describe('getFriendIds', () => {
    it('should map friend ids correctly', async () => {
      const friendships: Friend[] = [
        {
          id: '1',
          requesterId: 'user-1',
          addresseeId: 'user-2',
          status: FriendStatus.ACCEPTED,
        } as any,
        {
          id: '2',
          requesterId: 'user-3',
          addresseeId: 'user-1',
          status: FriendStatus.ACCEPTED,
        } as any,
      ];

      friendRepository.find.mockResolvedValue(friendships);

      const result = await service.getFriendIds('user-1');
      expect(result).toEqual(['user-2', 'user-3']);
    });
  });

  describe('areFriends', () => {
    it('should return true when friendship exists', async () => {
      friendRepository.findOne.mockResolvedValue({ id: '1' } as Friend);

      const result = await service.areFriends('u1', 'u2');
      expect(result).toBe(true);
    });

    it('should return false when friendship does not exist', async () => {
      friendRepository.findOne.mockResolvedValue(null);

      const result = await service.areFriends('u1', 'u2');
      expect(result).toBe(false);
    });
  });

  describe('getFriendsList', () => {
    it('should return sanitized users sorted by default order', async () => {
      const friendships: Friend[] = [
        {
          id: '1',
          requesterId: 'user-1',
          addresseeId: 'user-2',
          status: FriendStatus.ACCEPTED,
          requester: { id: 'user-1', firstName: 'A', lastName: 'A' } as any,
          addressee: { id: 'user-2', firstName: 'B', lastName: 'B' } as any,
          createdAt: new Date(),
        } as any,
      ];

      friendRepository.find.mockResolvedValue(friendships);

      const result = await service.getFriendsList('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-2');
      expect(sanitizeUserPublic).toHaveBeenCalled();
    });

    it('should sort alphabetically when sortBy is alphabetical', async () => {
      const friendships: Friend[] = [
        {
          id: '1',
          requesterId: 'user-1',
          addresseeId: 'user-2',
          status: FriendStatus.ACCEPTED,
          requester: { id: 'user-1', firstName: 'Z', lastName: 'Z' } as any,
          addressee: { id: 'user-2', firstName: 'A', lastName: 'A' } as any,
          createdAt: new Date(),
        } as any,
        {
          id: '2',
          requesterId: 'user-1',
          addresseeId: 'user-3',
          status: FriendStatus.ACCEPTED,
          requester: { id: 'user-1', firstName: 'Z', lastName: 'Z' } as any,
          addressee: { id: 'user-3', firstName: 'C', lastName: 'C' } as any,
          createdAt: new Date(),
        } as any,
      ];

      friendRepository.find.mockResolvedValue(friendships);

      const result = await service.getFriendsList(
        'user-1',
        FriendsListSortBy.ALPHABETICAL,
      );

      expect(result.map((u) => u.id)).toEqual(['user-2', 'user-3']);
    });

    it('should sort by most active when sortBy is most_active and activity service available', async () => {
      const friendships: Friend[] = [
        {
          id: '1',
          requesterId: 'user-1',
          addresseeId: 'user-2',
          status: FriendStatus.ACCEPTED,
          requester: { id: 'user-1', firstName: 'A', lastName: 'A' } as any,
          addressee: { id: 'user-2', firstName: 'B', lastName: 'B' } as any,
          createdAt: new Date(),
        } as any,
        {
          id: '2',
          requesterId: 'user-1',
          addresseeId: 'user-3',
          status: FriendStatus.ACCEPTED,
          requester: { id: 'user-1', firstName: 'A', lastName: 'A' } as any,
          addressee: { id: 'user-3', firstName: 'C', lastName: 'C' } as any,
          createdAt: new Date(),
        } as any,
      ];

      friendRepository.find.mockResolvedValue(friendships);

      (userActivityService.getActivityStats as jest.Mock)
        .mockResolvedValueOnce({
          lastActivity: new Date(Date.now() - 1000),
          totalActivities: 10,
        })
        .mockResolvedValueOnce({
          lastActivity: new Date(),
          totalActivities: 5,
        });

      const result = await service.getFriendsList(
        'user-1',
        FriendsListSortBy.MOST_ACTIVE,
      );

      expect(result.map((u) => u.id)).toEqual(['user-3', 'user-2']);
    });
  });

  describe('searchUsersForFriends', () => {
    it('should return empty array when query is empty', async () => {
      const result = await service.searchUsersForFriends('user-1', '  ');
      expect(result).toEqual([]);
    });

    it('should return mapped users with friendship status', async () => {
      const qbUsers: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'u2', firstName: 'John', lastName: 'Doe' } as User,
          ]),
      };

      userRepository.createQueryBuilder.mockReturnValue(qbUsers);

      const qbFriends: any = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            requesterId: 'user-1',
            addresseeId: 'u2',
            status: FriendStatus.ACCEPTED,
          } as Friend,
        ]),
      };

      friendRepository.createQueryBuilder.mockReturnValue(qbFriends);

      const result = await service.searchUsersForFriends('user-1', 'john', 10);

      expect(result).toHaveLength(1);
      expect(result[0].user.id).toBe('u2');
      expect(result[0].friendshipStatus).toBe(FriendStatus.ACCEPTED);
      expect(result[0].isRequester).toBe(true);
    });
  });

  describe('cancelFriendRequest', () => {
    it('should throw NotFoundException when request not found', async () => {
      friendRepository.findOne.mockResolvedValue(null);

      await expect(
        service.cancelFriendRequest('user-1', 'user-2'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should remove request when found', async () => {
      const friendRequest: Friend = {
        id: '1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: FriendStatus.PENDING,
      } as any;

      friendRepository.findOne.mockResolvedValue(friendRequest);
      friendRepository.remove.mockResolvedValue(friendRequest);

      await service.cancelFriendRequest('user-1', 'user-2');

      expect(friendRepository.remove).toHaveBeenCalledWith(friendRequest);
    });
  });
});
