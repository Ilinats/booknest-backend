import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsEnum, IsArray } from 'class-validator';
import { NotificationTypeEnum } from '../../notifications/enums/notification-type.enum';

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Array of enabled notification types',
    enum: NotificationTypeEnum,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationTypeEnum, { each: true })
  notificationPreferences?: NotificationTypeEnum[] | null;
}
