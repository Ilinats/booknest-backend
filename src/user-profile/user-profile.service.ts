import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from './entity/user-profile.entity';
import { PrivacyLevel } from './enums';
import { User } from '../users/entity/user.entity';
import { FriendsService } from '../friends/friends.service';
import { UserProfileErrorCode } from './errors';
import { UserType } from '../users/enums';
import { UsersService } from '../users/users.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { NotificationTypeEnum } from '../notifications/enums/notification-type.enum';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(forwardRef(() => FriendsService))
    private readonly friendsService: FriendsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => UserActivityService))
    private readonly userActivityService: UserActivityService,
  ) {}

  async createProfile(userId: string): Promise<UserProfile> {
    const existingProfile = await this.userProfileRepository.findOne({
      where: { userId },
    });

    if (existingProfile) {
      return existingProfile;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(UserProfileErrorCode.USER_NOT_FOUND);
    }

    const profile = this.userProfileRepository.create({
      userId,
      activityPrivacy: PrivacyLevel.PUBLIC,
      profilePrivacy: PrivacyLevel.PUBLIC,
      readingListPrivacy: PrivacyLevel.PUBLIC,
      reviewsPrivacy: PrivacyLevel.PUBLIC,
      notificationsEnabled: true,
      emailNotifications: true,
    });

    return this.userProfileRepository.save(profile);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    let profile = await this.userProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      profile = await this.createProfile(userId);
    } else {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      if (
        user?.userType === UserType.AUTHOR &&
        profile.profilePrivacy !== PrivacyLevel.PUBLIC
      ) {
        profile.profilePrivacy = PrivacyLevel.PUBLIC;
        profile = await this.userProfileRepository.save(profile);
      }
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    updates: Partial<UserProfile>,
  ): Promise<UserProfile> {
    const profile = await this.getProfile(userId);

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(UserProfileErrorCode.USER_NOT_FOUND);
    }

    if (
      user.userType === UserType.AUTHOR &&
      updates.profilePrivacy !== undefined
    ) {
      if (updates.profilePrivacy !== PrivacyLevel.PUBLIC) {
        throw new BadRequestException(
          'Authors cannot set their profile privacy to private or friends-only. Author profiles must be public.',
        );
      }

      updates.profilePrivacy = PrivacyLevel.PUBLIC;
    }

    Object.assign(profile, updates);
    return this.userProfileRepository.save(profile);
  }

  async updateSocialMedia(
    userId: string,
    socialMedia: {
      instagram?: string;
      tiktok?: string;
      youtube?: string;
      goodreads?: string;
      custom?: Array<{ platform: string; url: string }>;
    },
  ): Promise<UserProfile> {
    const profile = await this.getProfile(userId);
    profile.socialMedia = socialMedia;
    return this.userProfileRepository.save(profile);
  }

  async updatePrivacySettings(
    userId: string,
    settings: {
      activityPrivacy?: PrivacyLevel;
      profilePrivacy?: PrivacyLevel;
      readingListPrivacy?: PrivacyLevel;
      reviewsPrivacy?: PrivacyLevel;
    },
  ): Promise<UserProfile> {
    const profile = await this.getProfile(userId);

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(UserProfileErrorCode.USER_NOT_FOUND);
    }

    if (user.userType === UserType.AUTHOR) {
      if (settings.profilePrivacy !== undefined) {
        if (settings.profilePrivacy !== PrivacyLevel.PUBLIC) {
          throw new BadRequestException(
            'Authors cannot set their profile privacy to private or friends-only. Author profiles must be public.',
          );
        }
      }

      settings.profilePrivacy = PrivacyLevel.PUBLIC;
    }

    Object.assign(profile, settings);
    return this.userProfileRepository.save(profile);
  }

  async updateNotificationSettings(
    userId: string,
    settings: {
      notificationsEnabled?: boolean;
      emailNotifications?: boolean;
      notificationPreferences?: NotificationTypeEnum[] | null;
    },
  ): Promise<UserProfile> {
    const profile = await this.getProfile(userId);

    Object.assign(profile, settings);
    return this.userProfileRepository.save(profile);
  }

  async getPublicProfile(
    usernameOrId: string,
    viewerId?: string,
  ): Promise<{
    user: {
      id: string;
      username: string | null;
      firstName: string;
      lastName: string;
      userType: string;
      bio?: string | null;
      avatarUrl?: string | null;
      isVerified: boolean;
      createdAt: Date;
    };
    profile: {
      socialMedia?: any;
      stats?: any;
      profilePrivacy?: PrivacyLevel;
      activityPrivacy?: PrivacyLevel;
      readingListPrivacy?: PrivacyLevel;
      reviewsPrivacy?: PrivacyLevel;
    };
    isFriend?: boolean;
  }> {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        usernameOrId,
      );

    let user: User | null = null;

    if (isUUID) {
      user = await this.userRepository.findOne({
        where: { id: usernameOrId },
      });
    }

    if (!user) {
      user = await this.userRepository.findOne({
        where: { username: usernameOrId },
      });
    }

    if (!user && !isUUID) {
      user = await this.userRepository.findOne({
        where: { id: usernameOrId },
      });
    }

    if (!user) {
      throw new NotFoundException(UserProfileErrorCode.USER_NOT_FOUND);
    }

    const profile = await this.getProfile(user.id);

    let isFriend = false;
    if (viewerId && viewerId !== user.id) {
      isFriend = await this.friendsService.areFriends(viewerId, user.id);
    }

    const canViewProfile = this.checkProfileVisibility(
      profile.profilePrivacy,
      isFriend,
      viewerId === user.id,
      user.userType === UserType.AUTHOR,
    );

    if (!canViewProfile) {
      throw new NotFoundException(UserProfileErrorCode.PROFILE_PRIVATE);
    }

    let stats: any = null;
    try {
      stats = await this.usersService.getUserStats(user.id);
    } catch {
      // stats remain null on error
    }

    return {
      user: {
        id: user.id,
        username: user.username || null,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        bio: user.bio || null,
        avatarUrl: user.avatarUrl || null,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
      profile: {
        socialMedia: profile.socialMedia,
        stats: stats || undefined,
        profilePrivacy: profile.profilePrivacy,
        activityPrivacy: profile.activityPrivacy,
        readingListPrivacy: profile.readingListPrivacy,
        reviewsPrivacy: profile.reviewsPrivacy,
      },
      isFriend,
    };
  }

  private checkProfileVisibility(
    privacy: string,
    isFriend: boolean,
    isOwner: boolean,
    isAuthor: boolean = false,
  ): boolean {
    if (isOwner) return true;

    if (isAuthor) return true;
    if (privacy === 'public') return true;
    if (privacy === 'friends' && isFriend) return true;
    if (privacy === 'private') return false;
    return false;
  }

  async canViewProfile(
    viewerId: string,
    targetUserId: string,
  ): Promise<{
    canView: boolean;
    reason?: string;
  }> {
    if (viewerId === targetUserId) {
      return { canView: true };
    }

    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!user) {
      return { canView: false, reason: 'User not found' };
    }

    if (user.userType === UserType.AUTHOR) {
      return { canView: true };
    }

    const profile = await this.getProfile(targetUserId);

    if (profile.profilePrivacy === 'public') {
      return { canView: true };
    }

    if (profile.profilePrivacy === 'private') {
      return { canView: false, reason: 'Profile is private' };
    }

    if (profile.profilePrivacy === 'friends') {
      const areFriends = await this.friendsService.areFriends(
        viewerId,
        targetUserId,
      );
      if (!areFriends) {
        return { canView: false, reason: 'Profile is friends only' };
      }
      return { canView: true };
    }

    return { canView: false, reason: 'Access denied' };
  }

  async canViewActivity(
    viewerId: string,
    targetUserId: string,
  ): Promise<{
    canView: boolean;
    reason?: string;
  }> {
    if (viewerId === targetUserId) {
      return { canView: true };
    }

    const profile = await this.getProfile(targetUserId);

    if (profile.activityPrivacy === 'public') {
      return { canView: true };
    }

    if (profile.activityPrivacy === 'private') {
      return { canView: false, reason: 'Activity is private' };
    }

    if (profile.activityPrivacy === 'friends') {
      const areFriends = await this.friendsService.areFriends(
        viewerId,
        targetUserId,
      );
      if (!areFriends) {
        return { canView: false, reason: 'Activity is friends only' };
      }
      return { canView: true };
    }

    return { canView: false, reason: 'Access denied' };
  }

  async getUserRecentPublicActivity(
    usernameOrId: string,
    viewerId: string,
    days: number = 7,
    limit: number = 50,
  ) {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        usernameOrId,
      );

    let user: User | null = null;

    if (isUUID) {
      user = await this.userRepository.findOne({
        where: { id: usernameOrId },
      });
    }

    if (!user) {
      user = await this.userRepository.findOne({
        where: { username: usernameOrId },
      });
    }

    if (!user && !isUUID) {
      user = await this.userRepository.findOne({
        where: { id: usernameOrId },
      });
    }

    if (!user) {
      throw new NotFoundException(UserProfileErrorCode.USER_NOT_FOUND);
    }

    const canView = await this.canViewActivity(viewerId, user.id);
    if (!canView.canView) {
      throw new NotFoundException(
        canView.reason || UserProfileErrorCode.PROFILE_PRIVATE,
      );
    }

    return this.userActivityService.getRecentPublicActivity(
      user.id,
      days,
      limit,
    );
  }
}
