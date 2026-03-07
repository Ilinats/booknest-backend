import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfileService } from './user-profile.service';
import { UserProfile } from './entity/user-profile.entity';
import { User } from '../users/entity/user.entity';
import { FriendsService } from '../friends/friends.service';
import { UsersService } from '../users/users.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrivacyLevel } from './enums';
import { UserType } from '../users/enums';
import { NotificationTypeEnum } from '../notifications/enums/notification-type.enum';
import { UserProfileErrorCode } from './errors';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
}

describe('UserProfileService', () => {
  let service: UserProfileService;
  let userProfileRepository: MockRepo<UserProfile>;
  let userRepository: MockRepo<User>;
  let friendsService: jest.Mocked<FriendsService>;
  let usersService: jest.Mocked<UsersService>;
  let userActivityService: jest.Mocked<UserActivityService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        {
          provide: getRepositoryToken(UserProfile),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepo(),
        },
        {
          provide: FriendsService,
          useValue: {
            areFriends: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getUserStats: jest.fn(),
          },
        },
        {
          provide: UserActivityService,
          useValue: {
            getRecentPublicActivity: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    userProfileRepository = module.get(getRepositoryToken(UserProfile));
    userRepository = module.get(getRepositoryToken(User));
    friendsService = module.get(FriendsService);
    usersService = module.get(UsersService);
    userActivityService = module.get(UserActivityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProfile', () => {
    it('should return existing profile if present', async () => {
      const profile: UserProfile = {
        id: 'p1',
        userId: 'u1',
      } as any;

      userProfileRepository.findOne.mockResolvedValue(profile);

      const result = await service.createProfile('u1');

      expect(result).toBe(profile);
      expect(userProfileRepository.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      userProfileRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.createProfile('u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should create profile with default settings for existing user', async () => {
      userProfileRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue({ id: 'u1' } as User);

      const profile: UserProfile = {
        id: 'p1',
        userId: 'u1',
        activityPrivacy: PrivacyLevel.PUBLIC,
        profilePrivacy: PrivacyLevel.PUBLIC,
      } as any;

      userProfileRepository.create.mockReturnValue(profile);
      userProfileRepository.save.mockResolvedValue(profile);

      const result = await service.createProfile('u1');

      expect(userProfileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          activityPrivacy: PrivacyLevel.PUBLIC,
        }),
      );
      expect(result).toEqual(profile);
    });
  });

  describe('getProfile', () => {
    it('should create profile if not existing', async () => {
      const created: UserProfile = {
        id: 'p1',
        userId: 'u1',
      } as any;

      userProfileRepository.findOne.mockResolvedValueOnce(null);
      jest.spyOn(service, 'createProfile').mockResolvedValue(created);

      const result = await service.getProfile('u1');

      expect(result).toBe(created);
    });

    it('should force author profiles to PUBLIC', async () => {
      const profile: UserProfile = {
        id: 'p1',
        userId: 'u1',
        profilePrivacy: PrivacyLevel.PRIVATE,
      } as any;

      userProfileRepository.findOne.mockResolvedValue(profile);
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        userType: UserType.AUTHOR,
      } as any);

      userProfileRepository.save.mockImplementation(async (p) => p);

      const result = await service.getProfile('u1');

      expect(result.profilePrivacy).toBe(PrivacyLevel.PUBLIC);
    });
  });

  describe('updateProfile', () => {
    const baseProfile: UserProfile = {
      id: 'p1',
      userId: 'u1',
      profilePrivacy: PrivacyLevel.PUBLIC,
    } as any;

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(service, 'getProfile').mockResolvedValue(baseProfile);
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('u1', { bio: 'New bio' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should prevent authors from setting non-public profile privacy', async () => {
      jest.spyOn(service, 'getProfile').mockResolvedValue(baseProfile);
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        userType: UserType.AUTHOR,
      } as any);

      await expect(
        service.updateProfile('u1', {
          profilePrivacy: PrivacyLevel.PRIVATE,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should update profile for reader user', async () => {
      const profile: UserProfile = { ...baseProfile };

      jest.spyOn(service, 'getProfile').mockResolvedValue(profile);
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        userType: UserType.READER,
      } as any);

      userProfileRepository.save.mockImplementation(async (p) => p);

      const result = await service.updateProfile('u1', {
        activityPrivacy: PrivacyLevel.PRIVATE,
      } as any);

      expect(result.activityPrivacy).toBe(PrivacyLevel.PRIVATE);
    });
  });

  describe('updateSocialMedia', () => {
    it('should update socialMedia field on profile', async () => {
      const profile: UserProfile = {
        id: 'p1',
        userId: 'u1',
      } as any;

      jest.spyOn(service, 'getProfile').mockResolvedValue(profile);
      userProfileRepository.save.mockImplementation(async (p) => p);

      const social = { instagram: '@insta', custom: [] };

      const result = await service.updateSocialMedia('u1', social);

      expect(result.socialMedia).toBe(social);
    });
  });

  describe('updatePrivacySettings', () => {
    const profile: UserProfile = {
      id: 'p1',
      userId: 'u1',
      profilePrivacy: PrivacyLevel.PUBLIC,
    } as any;

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(service, 'getProfile').mockResolvedValue(profile);
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePrivacySettings('u1', {
          profilePrivacy: PrivacyLevel.PRIVATE,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should reject non-public profile privacy for authors', async () => {
      jest.spyOn(service, 'getProfile').mockResolvedValue(profile);
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        userType: UserType.AUTHOR,
      } as any);

      await expect(
        service.updatePrivacySettings('u1', {
          profilePrivacy: PrivacyLevel.PRIVATE,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should force profilePrivacy to PUBLIC for authors', async () => {
      jest.spyOn(service, 'getProfile').mockResolvedValue(profile);
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        userType: UserType.AUTHOR,
      } as any);

      userProfileRepository.save.mockImplementation(async (p) => p);

      const result = await service.updatePrivacySettings('u1', {});

      expect(result.profilePrivacy).toBe(PrivacyLevel.PUBLIC);
    });
  });

  describe('updateNotificationSettings', () => {
    it('should merge notification settings into profile', async () => {
      const profile: UserProfile = {
        id: 'p1',
        userId: 'u1',
        notificationsEnabled: true,
        emailNotifications: true,
      } as any;

      jest.spyOn(service, 'getProfile').mockResolvedValue(profile);
      userProfileRepository.save.mockImplementation(async (p) => p);

      const result = await service.updateNotificationSettings('u1', {
        notificationsEnabled: false,
        notificationPreferences: [NotificationTypeEnum.FRIEND_REQUEST_RECEIVED],
      });

      expect(result.notificationsEnabled).toBe(false);
      expect(result.notificationPreferences).toEqual([
        NotificationTypeEnum.FRIEND_REQUEST_RECEIVED,
      ]);
    });
  });

  describe('getPublicProfile', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPublicProfile('unknown', 'viewer'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw NotFoundException when profile is private', async () => {
      const user: User = {
        id: 'u1',
        username: 'user1',
        firstName: 'Test',
        lastName: 'User',
        userType: UserType.READER,
        bio: null,
        avatarUrl: null,
        isVerified: false,
        createdAt: new Date(),
      } as any;

      userRepository.findOne.mockResolvedValueOnce(user); // by username/id
      const profile: UserProfile = {
        id: 'p1',
        userId: 'u1',
        profilePrivacy: PrivacyLevel.PRIVATE,
      } as any;

      jest.spyOn(service, 'getProfile').mockResolvedValue(profile);
      friendsService.areFriends.mockResolvedValue(false);

      await expect(
        service.getPublicProfile('user1', 'viewer-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('canViewProfile', () => {
    it('should allow owner', async () => {
      const result = await service.canViewProfile('u1', 'u1');
      expect(result.canView).toBe(true);
    });

    it('should allow authors always', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'u2',
        userType: UserType.AUTHOR,
      } as any);

      const result = await service.canViewProfile('viewer', 'u2');
      expect(result.canView).toBe(true);
    });

    it('should allow public profiles', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'u2',
        userType: UserType.READER,
      } as any);

      jest.spyOn(service, 'getProfile').mockResolvedValue({
        userId: 'u2',
        profilePrivacy: PrivacyLevel.PUBLIC,
      } as any);

      const result = await service.canViewProfile('viewer', 'u2');
      expect(result.canView).toBe(true);
    });

    it('should deny private profiles', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'u2',
        userType: UserType.READER,
      } as any);

      jest.spyOn(service, 'getProfile').mockResolvedValue({
        userId: 'u2',
        profilePrivacy: PrivacyLevel.PRIVATE,
      } as any);

      const result = await service.canViewProfile('viewer', 'u2');
      expect(result.canView).toBe(false);
    });
  });

  describe('canViewActivity', () => {
    it('should allow owner', async () => {
      const result = await service.canViewActivity('u1', 'u1');
      expect(result.canView).toBe(true);
    });

    it('should allow public activity', async () => {
      jest.spyOn(service, 'getProfile').mockResolvedValue({
        userId: 'u2',
        activityPrivacy: PrivacyLevel.PUBLIC,
      } as any);

      const result = await service.canViewActivity('viewer', 'u2');
      expect(result.canView).toBe(true);
    });

    it('should deny private activity', async () => {
      jest.spyOn(service, 'getProfile').mockResolvedValue({
        userId: 'u2',
        activityPrivacy: PrivacyLevel.PRIVATE,
      } as any);

      const result = await service.canViewActivity('viewer', 'u2');
      expect(result.canView).toBe(false);
    });
  });

  describe('getUserRecentPublicActivity', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getUserRecentPublicActivity('unknown', 'viewer'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should forward to userActivityService when access is allowed', async () => {
      const user: User = {
        id: 'u1',
        username: 'user1',
      } as any;

      userRepository.findOne
        .mockResolvedValueOnce(user) // by username/id
        .mockResolvedValueOnce(user); // for fallback branches if any

      jest
        .spyOn(service, 'canViewActivity')
        .mockResolvedValue({ canView: true });

      userActivityService.getRecentPublicActivity.mockResolvedValue([]);

      const result = await service.getUserRecentPublicActivity(
        'user1',
        'viewer',
        7,
        20,
      );

      expect(userActivityService.getRecentPublicActivity).toHaveBeenCalledWith(
        'u1',
        7,
        20,
      );
      expect(result).toEqual([]);
    });
  });
});
