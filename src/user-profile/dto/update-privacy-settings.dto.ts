import { IsOptional, IsEnum } from 'class-validator';
import { PrivacyLevel } from '../enums';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePrivacySettingsDto {
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
}
