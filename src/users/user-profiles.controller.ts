import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Param, 
  Body, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserProfileService } from './user-profile.service';
import { UserActivityService } from './user-activity.service';
import { 
  UpdateUserProfileDto, 
  UpdatePrivacySettingsDto, 
  UpdateNotificationSettingsDto 
} from './dto/user-profile.dto';
import { SocialMediaDto } from './dto/social-media.dto';
import { getUserId } from '../common/get-user-id.util';

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class UserProfilesController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly userActivityService: UserActivityService,
  ) {}

  @Get('me')
  async getMyProfile(@Request() req: any) {
    const userId = getUserId(req);
    return this.userProfileService.getProfile(userId);
  }

  @Put('me')
  async updateMyProfile(
    @Request() req: any,
    @Body() updates: UpdateUserProfileDto
  ) {
    const userId = getUserId(req);
    return this.userProfileService.updateProfile(userId, updates);
  }

  @Put('me/social-media')
  async updateSocialMedia(
    @Request() req: any,
    @Body() socialMedia: SocialMediaDto
  ) {
    const userId = getUserId(req);
    return this.userProfileService.updateSocialMedia(userId, socialMedia);
  }

  @Put('me/privacy')
  async updatePrivacySettings(
    @Request() req: any,
    @Body() settings: UpdatePrivacySettingsDto
  ) {
    const userId = getUserId(req);
    return this.userProfileService.updatePrivacySettings(userId, settings);
  }

  @Put('me/notifications')
  async updateNotificationSettings(
    @Request() req: any,
    @Body() settings: UpdateNotificationSettingsDto
  ) {
    const userId = getUserId(req);
    return this.userProfileService.updateNotificationSettings(userId, settings);
  }

  @Get('user/:username')
  async getPublicProfile(
    @Request() req: any,
    @Param('username') username: string
  ) {
    const viewerId = req.user?.sub || req.user?.id;
    return this.userProfileService.getPublicProfile(username, viewerId);
  }

  @Get('me/activity')
  async getMyActivity(
    @Request() req: any,
    @Param('limit') limit?: number
  ) {
    const userId = getUserId(req);
    return this.userActivityService.getUserActivity(userId, limit);
  }

  @Get('me/activity/public')
  async getMyPublicActivity(
    @Request() req: any,
    @Param('limit') limit?: number
  ) {
    const userId = getUserId(req);
    return this.userActivityService.getPublicActivity(userId, limit);
  }

  @Get('me/activity/recent')
  async getMyRecentActivity(
    @Request() req: any,
    @Param('days') days?: number,
    @Param('limit') limit?: number
  ) {
    const userId = getUserId(req);
    return this.userActivityService.getRecentActivity(userId, days, limit);
  }

  @Get('me/activity/stats')
  async getMyActivityStats(@Request() req: any) {
    const userId = getUserId(req);
    return this.userActivityService.getActivityStats(userId);
  }

  @Get('social-media/options')
  async getSocialMediaOptions() {
    return {
      predefined: [
        {
          key: 'instagram',
          name: 'Instagram',
          icon: 'instagram',
          placeholder: 'https://instagram.com/username'
        },
        {
          key: 'tiktok',
          name: 'TikTok',
          icon: 'tiktok',
          placeholder: 'https://tiktok.com/@username'
        },
        {
          key: 'youtube',
          name: 'YouTube',
          icon: 'youtube',
          placeholder: 'https://youtube.com/@username'
        },
        {
          key: 'goodreads',
          name: 'Goodreads',
          icon: 'goodreads',
          placeholder: 'https://goodreads.com/user/show/username'
        }
      ],
      custom: {
        enabled: true,
        maxCustomLinks: 5,
        placeholder: 'Add custom social media link'
      }
    };
  }
}
