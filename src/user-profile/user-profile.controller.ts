import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserProfileService } from './user-profile.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { UserAddressService } from '../user-address/user-address.service';
import { getUserId } from '../common';
import { CreateAddressDto, UpdateAddressDto } from '../user-address/dto';
import {
  UpdateSocialMediaDto,
  UpdatePrivacySettingsDto,
  UpdateNotificationSettingsDto,
} from './dto';

@ApiTags('User Profiles')
@Controller('profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserProfileController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly userActivityService: UserActivityService,
    private readonly userAddressService: UserAddressService,
  ) {}

  @Get('user/:usernameOrId')
  @ApiOperation({
    summary: 'Get public profile by username or user ID (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'Public user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPublicProfile(
    @Request() req: any,
    @Param('usernameOrId') usernameOrId: string,
  ) {
    const viewerId = req.user?.sub || req.user?.id;
    return this.userProfileService.getPublicProfile(usernameOrId, viewerId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile (Authenticated)' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyProfile(@Request() req: any) {
    const userId = getUserId(req);
    return this.userProfileService.getProfile(userId);
  }

  @Get('me/activity')
  @ApiOperation({ summary: 'Get current user activity (Authenticated)' })
  @ApiResponse({ status: 200, description: 'User activity' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyActivity(@Request() req: any, @Param('limit') limit?: number) {
    const userId = getUserId(req);
    return this.userActivityService.getUserActivity(userId, limit);
  }

  @Get('me/activity/public')
  @ApiOperation({ summary: 'Get current user public activity (Authenticated)' })
  @ApiResponse({ status: 200, description: 'Public user activity' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyPublicActivity(
    @Request() req: any,
    @Param('limit') limit?: number,
  ) {
    const userId = getUserId(req);
    return this.userActivityService.getPublicActivity(userId, limit);
  }

  @Get('me/activity/recent')
  @ApiOperation({ summary: 'Get current user recent activity (Authenticated)' })
  @ApiResponse({ status: 200, description: 'Recent user activity' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyRecentActivity(
    @Request() req: any,
    @Param('days') days?: number,
    @Param('limit') limit?: number,
  ) {
    const userId = getUserId(req);
    return this.userActivityService.getRecentActivity(userId, days, limit);
  }

  @Get('me/activity/stats')
  @ApiOperation({
    summary: 'Get current user activity statistics (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'User activity statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyActivityStats(@Request() req: any) {
    const userId = getUserId(req);
    return this.userActivityService.getActivityStats(userId);
  }

  @Get('me/addresses')
  @ApiOperation({
    summary: 'Get current user addresses (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'List of user addresses' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyAddresses(@Request() req: any) {
    const userId = getUserId(req);
    return this.userAddressService.findByUserId(userId);
  }

  @Get('user/:usernameOrId/activity/recent')
  @ApiOperation({
    summary:
      'Get user public recent activity by username or ID (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'User recent public activity' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Activity is private' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserRecentActivity(
    @Request() req: any,
    @Param('usernameOrId') usernameOrId: string,
    @Query('days') days?: number,
    @Query('limit') limit?: number,
  ) {
    const viewerId = getUserId(req);
    return this.userProfileService.getUserRecentPublicActivity(
      usernameOrId,
      viewerId,
      days ? parseInt(days.toString(), 10) : 7,
      limit ? parseInt(limit.toString(), 10) : 50,
    );
  }

  @Post('me/addresses')
  @ApiOperation({
    summary: 'Create a new address (Authenticated)',
  })
  @ApiResponse({ status: 201, description: 'Address created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createAddress(@Request() req: any, @Body() dto: CreateAddressDto) {
    const userId = getUserId(req);
    return this.userAddressService.create(userId, dto);
  }

  @Put('me/addresses/:addressId')
  @ApiOperation({
    summary: 'Update an address (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'Address updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateAddress(
    @Request() req: any,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const userId = getUserId(req);
    return this.userAddressService.update(userId, addressId, dto);
  }

  @Delete('me/addresses/:addressId')
  @ApiOperation({
    summary: 'Delete an address (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'Address deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async deleteAddress(
    @Request() req: any,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    const userId = getUserId(req);
    await this.userAddressService.remove(userId, addressId);
    return { message: 'Address deleted successfully' };
  }

  @Put('me/social-media')
  @ApiOperation({
    summary: 'Update social media links (Authenticated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Social media updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateSocialMedia(
    @Request() req: any,
    @Body() dto: UpdateSocialMediaDto,
  ) {
    const userId = getUserId(req);

    const socialMedia = {
      instagram: dto.instagram,
      tiktok: dto.tiktok,
      youtube: dto.youtube,
      goodreads: dto.goodreads,
      custom: dto.custom,
    };
    return this.userProfileService.updateSocialMedia(userId, socialMedia);
  }

  @Put('me/privacy')
  @ApiOperation({
    summary: 'Update privacy settings (Authenticated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Privacy settings updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updatePrivacySettings(
    @Request() req: any,
    @Body() dto: UpdatePrivacySettingsDto,
  ) {
    const userId = getUserId(req);
    return this.userProfileService.updatePrivacySettings(userId, dto);
  }

  @Put('me/notifications')
  @ApiOperation({
    summary: 'Update notification settings (Authenticated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification settings updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateNotificationSettings(
    @Request() req: any,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    const userId = getUserId(req);
    return this.userProfileService.updateNotificationSettings(userId, {
      notificationsEnabled: dto.notificationsEnabled,
      emailNotifications: dto.emailNotifications,
      notificationPreferences: dto.notificationPreferences,
    });
  }
}
