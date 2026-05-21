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
  UsePipes,
  ValidationPipe,
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
import { UserActivityService } from '../user-activity/user-activity.service';
import { getUserId } from '../common';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { UserType } from '../users/enums';
import { FriendRequestType, FriendStatus } from './enums';
import { GetFriendsQueryDto } from './dto/get-friends-query.dto';

@ApiTags('Friends')
@Controller('friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
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
  @ApiOperation({
    summary: 'Get friends or pending requests (Authenticated)',
    description:
      'status=accepted (default): accepted friends. status=pending: pending requests; use type=sent or type=received (default received).',
  })
  @ApiResponse({ status: 200, description: 'List of user profiles' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getFriends(
    @Request() req: any,
    @Query() query: GetFriendsQueryDto,
  ) {
    const userId = getUserId(req);
    const status = query.status ?? FriendStatus.ACCEPTED;

    if (status === FriendStatus.PENDING) {
      return this.friendsService.getPendingFriendRequests(
        userId,
        query.type ?? FriendRequestType.RECEIVED,
      );
    }

    return this.friendsService.getFriendsList(userId, query.sortBy);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search users to add as friends (Authenticated)',
    description:
      'Search for users by username or name. Returns friendship status for each user.',
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
  @ApiResponse({ status: 200, description: 'List of users with friendship status' })
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
