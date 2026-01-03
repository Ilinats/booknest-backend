import { IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { CustomSocialMediaDto } from './custom-social-media.dto';
import { PrivacyLevel } from '../enums';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  socialMedia?: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    goodreads?: string;
    custom?: CustomSocialMediaDto[];
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(PrivacyLevel)
  activityPrivacy?: PrivacyLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(PrivacyLevel)
  profilePrivacy?: PrivacyLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(PrivacyLevel)
  readingListPrivacy?: PrivacyLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(PrivacyLevel)
  reviewsPrivacy?: PrivacyLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;
}
