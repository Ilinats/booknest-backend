import { IsString, IsOptional, IsEnum, IsBoolean, IsObject, IsArray, ValidateNested, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomSocialMediaDto {
  @IsString()
  platform!: string;

  @IsString()
  @IsUrl()
  url!: string;
}

export type PrivacyLevel = 'public' | 'friends' | 'private';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsObject()
  socialMedia?: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    goodreads?: string;
    custom?: CustomSocialMediaDto[];
  };

  @IsOptional()
  @IsEnum(['public', 'friends', 'private'])
  activityPrivacy?: PrivacyLevel;

  @IsOptional()
  @IsEnum(['public', 'friends', 'private'])
  profilePrivacy?: PrivacyLevel;

  @IsOptional()
  @IsEnum(['public', 'friends', 'private'])
  readingListPrivacy?: PrivacyLevel;

  @IsOptional()
  @IsEnum(['public', 'friends', 'private'])
  reviewsPrivacy?: PrivacyLevel;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;
}

export class UpdateSocialMediaDto {
  @IsOptional()
  @IsObject()
  socialMedia?: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    goodreads?: string;
    custom?: CustomSocialMediaDto[];
  };
}

export class UpdatePrivacySettingsDto {
  @IsOptional()
  @IsEnum(['public', 'friends', 'private'])
  activityPrivacy?: PrivacyLevel;

  @IsOptional()
  @IsEnum(['public', 'friends', 'private'])
  profilePrivacy?: PrivacyLevel;

  @IsOptional()
  @IsEnum(['public', 'friends', 'private'])
  readingListPrivacy?: PrivacyLevel;

  @IsOptional()
  @IsEnum(['public', 'friends', 'private'])
  reviewsPrivacy?: PrivacyLevel;
}

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsObject()
  notificationPreferences?: {
    friendRequests?: boolean;
    friendRequestAccepted?: boolean;
    applicationApproved?: boolean;
    applicationRejected?: boolean;
    reviewDeadlineReminders?: boolean;
    authorBookPublished?: boolean;
  };
}
