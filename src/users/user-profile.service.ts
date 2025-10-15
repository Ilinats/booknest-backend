import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile, PrivacyLevel } from './entity/user-profile.entity';
import { User } from './entity/user.entity';
import { FriendsService } from './friends.service';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly friendsService: FriendsService,
  ) {}

  async createProfile(userId: string): Promise<UserProfile> {
    const existingProfile = await this.userProfileRepository.findOne({
      where: { userId }
    });

    if (existingProfile) {
      return existingProfile;
    }

    const profile = this.userProfileRepository.create({
      userId,
      activityPrivacy: 'friends',
      profilePrivacy: 'friends',
      readingListPrivacy: 'friends',
      reviewsPrivacy: 'public',
      notificationsEnabled: true,
      emailNotifications: true
    });

    return this.userProfileRepository.save(profile);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    let profile = await this.userProfileRepository.findOne({
      where: { userId }
    });

    if (!profile) {
      profile = await this.createProfile(userId);
    }

    return profile;
  }

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const profile = await this.getProfile(userId);

    Object.assign(profile, updates);
    return this.userProfileRepository.save(profile);
  }

  async updateSocialMedia(userId: string, socialMedia: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    goodreads?: string;
    custom?: Array<{ platform: string; url: string }>;
  }): Promise<UserProfile> {
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
    }
  ): Promise<UserProfile> {
    const profile = await this.getProfile(userId);
    
    Object.assign(profile, settings);
    return this.userProfileRepository.save(profile);
  }

  async updateNotificationSettings(
    userId: string,
    settings: {
      notificationsEnabled?: boolean;
      emailNotifications?: boolean;
    }
  ): Promise<UserProfile> {
    const profile = await this.getProfile(userId);
    
    Object.assign(profile, settings);
    return this.userProfileRepository.save(profile);
  }

  async getPublicProfile(username: string, viewerId?: string): Promise<{
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
    };
    isFriend?: boolean;
  }> {
    const user = await this.userRepository.findOne({
      where: { username }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.getProfile(user.id);

    let isFriend = false;
    if (viewerId && viewerId !== user.id) {
      isFriend = await this.friendsService.areFriends(viewerId, user.id);
    }

    const canViewProfile = this.checkProfileVisibility(profile.profilePrivacy, isFriend, viewerId === user.id);
    
    if (!canViewProfile) {
      throw new NotFoundException('Profile is private');
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
        createdAt: user.createdAt
      },
      profile: {
        socialMedia: profile.socialMedia
      },
      isFriend
    };
  }

  private checkProfileVisibility(privacy: string, isFriend: boolean, isOwner: boolean): boolean {
    if (isOwner) return true;
    if (privacy === 'public') return true;
    if (privacy === 'friends' && isFriend) return true;
    if (privacy === 'private') return false;
    return false;
  }

  async canViewProfile(viewerId: string, targetUserId: string): Promise<{
    canView: boolean;
    reason?: string;
  }> {
    if (viewerId === targetUserId) {
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
      const areFriends = await this.friendsService.areFriends(viewerId, targetUserId);
      if (!areFriends) {
        return { canView: false, reason: 'Profile is friends only' };
      }
      return { canView: true };
    }

    return { canView: false, reason: 'Access denied' };
  }

  async canViewActivity(viewerId: string, targetUserId: string): Promise<{
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
      const areFriends = await this.friendsService.areFriends(viewerId, targetUserId);
      if (!areFriends) {
        return { canView: false, reason: 'Activity is friends only' };
      }
      return { canView: true };
    }

    return { canView: false, reason: 'Access denied' };
  }
}
