import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  notificationPreferences?: {
    friendRequests?: boolean;
    friendRequestAccepted?: boolean;
    applicationApproved?: boolean;
    applicationRejected?: boolean;
    reviewDeadlineReminders?: boolean;
    authorBookPublished?: boolean;
  } | null;
}
