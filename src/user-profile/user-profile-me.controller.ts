import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
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
  UpdateNotificationSettingsDto,
  UpdatePrivacySettingsDto,
  UpdateSocialMediaDto,
} from './dto';
import { Request as ExpressRequest } from 'express';

@ApiTags('User Profiles')
@Controller('users/me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserProfileMeController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly userActivityService: UserActivityService,
    private readonly userAddressService: UserAddressService,
  ) {}

  @Post('addresses')
  @ApiOperation({ summary: 'Create a new address (Authenticated)' })
  @ApiResponse({ status: 201, description: 'Address created successfully' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createAddress(
    @Request() req: ExpressRequest,
    @Body() dto: CreateAddressDto,
  ) {
    const userId = getUserId(req);
    return this.userAddressService.create(userId, dto);
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile settings (Authenticated)',
    description: 'Extended profile (privacy, social, etc.). Account fields: GET /users/me.',
  })
  @ApiResponse({ status: 200, description: 'User profile' })
  getMyProfile(@Request() req: ExpressRequest) {
    const userId = getUserId(req);
    return this.userProfileService.getProfile(userId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get current user activity (Authenticated)' })
  getMyActivity(
    @Request() req: ExpressRequest,
    @Query('limit') limit?: number,
  ) {
    const userId = getUserId(req);
    return this.userActivityService.getUserActivity(
      userId,
      limit ? parseInt(limit.toString(), 10) : undefined,
    );
  }

  @Get('activity/public')
  getMyPublicActivity(
    @Request() req: ExpressRequest,
    @Query('limit') limit?: number,
  ) {
    const userId = getUserId(req);
    return this.userActivityService.getPublicActivity(
      userId,
      limit ? parseInt(limit.toString(), 10) : undefined,
    );
  }

  @Get('activity/recent')
  getMyRecentActivity(
    @Request() req: ExpressRequest,
    @Query('days') days?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = getUserId(req);
    return this.userActivityService.getRecentActivity(
      userId,
      days ? parseInt(days.toString(), 10) : undefined,
      limit ? parseInt(limit.toString(), 10) : undefined,
    );
  }

  @Get('activity/stats')
  getMyActivityStats(@Request() req: ExpressRequest) {
    const userId = getUserId(req);
    return this.userActivityService.getActivityStats(userId);
  }

  @Get('addresses')
  getMyAddresses(@Request() req: ExpressRequest) {
    const userId = getUserId(req);
    return this.userAddressService.findByUserId(userId);
  }

  @Patch('addresses/:addressId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateAddress(
    @Request() req: ExpressRequest,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const userId = getUserId(req);
    return this.userAddressService.update(userId, addressId, dto);
  }

  @Patch('social-media')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateSocialMedia(
    @Request() req: ExpressRequest,
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

  @Patch('privacy')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updatePrivacySettings(
    @Request() req: ExpressRequest,
    @Body() dto: UpdatePrivacySettingsDto,
  ) {
    const userId = getUserId(req);
    return this.userProfileService.updatePrivacySettings(userId, dto);
  }

  @Patch('notifications')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateNotificationSettings(
    @Request() req: ExpressRequest,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    const userId = getUserId(req);
    return this.userProfileService.updateNotificationSettings(userId, {
      notificationsEnabled: dto.notificationsEnabled,
      emailNotifications: dto.emailNotifications,
      notificationPreferences: dto.notificationPreferences,
    });
  }

  @Delete('addresses/:addressId')
  async deleteAddress(
    @Request() req: ExpressRequest,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    const userId = getUserId(req);
    await this.userAddressService.remove(userId, addressId);
    return { message: 'Address deleted successfully' };
  }
}
