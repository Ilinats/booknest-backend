import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserProfileService } from './user-profile.service';
import { getUserId } from '../common';
import { Request as ExpressRequest } from 'express';

@ApiTags('User Profiles')
@Controller('profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get('user/:usernameOrId')
  @ApiOperation({
    summary: 'Get public profile by username or user ID (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'Public user profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getPublicProfile(
    @Request() req: ExpressRequest,
    @Param('usernameOrId') usernameOrId: string,
  ) {
    const viewerId = getUserId(req);
    return this.userProfileService.getPublicProfile(usernameOrId, viewerId);
  }

  @Get('user/:usernameOrId/activity/recent')
  @ApiOperation({
    summary:
      'Get user public recent activity by username or ID (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'User recent public activity' })
  @ApiResponse({ status: 403, description: 'Activity is private' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserRecentActivity(
    @Request() req: ExpressRequest,
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
}
