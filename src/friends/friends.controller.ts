import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendsService } from './friends.service';
import { UserProfileService } from '../user-profile/user-profile.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { getUserId } from '../common';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { UserType } from '../users/enums';
import { FriendRequestType, FriendStatus, FriendsListSortBy } from './enums';

@ApiTags('Friends')
@Controller('friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
    private readonly userProfileService: UserProfileService,
    private readonly userActivityService: UserActivityService,
  ) {}

  @Post('request/:username')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a friend request (Authenticated)' })
  @ApiResponse({ status: 201, description: 'Friend request sent successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sendFriendRequest(
    @Request() req: any,
    @Param('username') username: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userId = getUserId(req);
    return this.friendsService.sendFriendRequest(
      userId,
      username,
      user.userType,
    );
  }

  @Post('accept/:requesterId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a friend request (Authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'Friend request accepted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async acceptFriendRequest(
    @Request() req: any,
    @Param('requesterId') requesterId: string,
  ) {
    const userId = getUserId(req);
    return this.friendsService.acceptFriendRequest(userId, requesterId);
  }

  @Get()
  @ApiOperation({ summary: 'Get friends list (Authenticated)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: FriendStatus,
    description: 'Filter by friend status',
  })
  @ApiResponse({ status: 200, description: 'List of friends' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriends(
    @Request() req: any,
    @Query('status') status?: FriendStatus,
  ) {
    const userId = getUserId(req);
    return this.friendsService.getFriends(userId, status);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Get all accepted friends as user list (Authenticated)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: FriendsListSortBy,
    description: 'Sort order for friends list',
  })
  @ApiResponse({
    status: 200,
    description: 'List of friends (user information)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriendsList(
    @Request() req: any,
    @Query('sortBy') sortBy?: FriendsListSortBy,
  ) {
    const userId = getUserId(req);
    return this.friendsService.getFriendsList(userId, sortBy);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search users to add as friends (Authenticated)',
    description:
      'Search for users by username or name, excluding current friends. Returns friendship status for each user.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search query (username or name)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of results (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users with friendship status',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/UserPublicResponseDto' },
          friendshipStatus: {
            type: 'string',
            enum: ['accepted', 'pending', null],
            nullable: true,
          },
          isRequester: { type: 'boolean' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchUsersForFriends(
    @Request() req: any,
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    const userId = getUserId(req);
    const limitNum = limit ? parseInt(limit.toString(), 10) : 20;
    return this.friendsService.searchUsersForFriends(
      userId,
      query,
      limitNum > 0 ? limitNum : 20,
    );
  }

  @Get('requests/sent')
  @ApiOperation({
    summary: 'Get sent friend requests as user list (Authenticated)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of sent friend requests (user information)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSentRequests(@Request() req: any) {
    const userId = getUserId(req);
    return this.friendsService.getSentRequestsList(userId);
  }

  @Get('requests/received')
  @ApiOperation({
    summary: 'Get received friend requests as user list (Authenticated)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of received friend requests (user information)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getReceivedRequests(@Request() req: any) {
    const userId = getUserId(req);
    return this.friendsService.getReceivedRequestsList(userId);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get friend requests (Authenticated)' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: FriendRequestType,
    description: 'Filter by request type',
  })
  @ApiResponse({ status: 200, description: 'List of friend requests' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriendRequests(
    @Request() req: any,
    @Query('type') type?: FriendRequestType,
  ) {
    const userId = getUserId(req);
    return this.friendsService.getFriendRequests(userId, type);
  }

  @Get('status/:userId')
  @ApiOperation({
    summary: 'Get friendship status with a user (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'Friendship status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriendshipStatus(
    @Request() req: any,
    @Param('userId') userId: string,
  ) {
    const currentUserId = getUserId(req);
    return this.friendsService.getFriendshipStatus(currentUserId, userId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get friends activity feed (Authenticated)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of activities',
  })
  @ApiResponse({ status: 200, description: 'Friends activity feed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriendsActivity(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: number,
  ) {
    const userId = user.sub;
    const friendIds = await this.friendsService.getFriendIds(userId);
    return this.userActivityService.getFriendsActivity(
      userId,
      friendIds,
      limit,
      user.userType as UserType,
    );
  }

  @Delete('decline/:requesterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Decline a friend request (Authenticated)' })
  @ApiResponse({ status: 204, description: 'Friend request declined' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async declineFriendRequest(
    @Request() req: any,
    @Param('requesterId') requesterId: string,
  ) {
    const userId = getUserId(req);
    await this.friendsService.declineFriendRequest(userId, requesterId);
  }

  @Delete('unfriend/:friendId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfriend a user (Authenticated)' })
  @ApiResponse({ status: 204, description: 'Unfriended successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unfriend(@Request() req: any, @Param('friendId') friendId: string) {
    const userId = getUserId(req);
    await this.friendsService.unfriend(userId, friendId);
  }

  @Delete('cancel/:addresseeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a sent friend request (Authenticated)' })
  @ApiResponse({ status: 204, description: 'Friend request canceled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async cancelFriendRequest(
    @Request() req: any,
    @Param('addresseeId') addresseeId: string,
  ) {
    const userId = getUserId(req);
    await this.friendsService.cancelFriendRequest(userId, addresseeId);
  }
}
