import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  Body,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FriendsService } from './friends.service';
import { UserProfileService } from './user-profile.service';
import { AuthorFollowService } from './author-follow.service';
import { UserActivityService } from './user-activity.service';
import { SendFriendRequestDto } from './dto/friend-request.dto';
import { getUserId } from '../common/get-user-id.util';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
    private readonly userProfileService: UserProfileService,
    private readonly authorFollowService: AuthorFollowService,
    private readonly userActivityService: UserActivityService,
  ) {}

  @Post('request/:username')
  @HttpCode(HttpStatus.CREATED)
  async sendFriendRequest(
    @Request() req: any,
    @Param('username') username: string
  ) {
    const userId = getUserId(req);
    return this.friendsService.sendFriendRequest(userId, username);
  }

  @Post('accept/:requesterId')
  @HttpCode(HttpStatus.OK)
  async acceptFriendRequest(
    @Request() req: any,
    @Param('requesterId') requesterId: string
  ) {
    const userId = getUserId(req);
    return this.friendsService.acceptFriendRequest(userId, requesterId);
  }

  @Delete('decline/:requesterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineFriendRequest(
    @Request() req: any,
    @Param('requesterId') requesterId: string
  ) {
    const userId = getUserId(req);
    await this.friendsService.declineFriendRequest(userId, requesterId);
  }

  @Delete('unfriend/:friendId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfriend(
    @Request() req: any,
    @Param('friendId') friendId: string
  ) {
    const userId = getUserId(req);
    await this.friendsService.unfriend(userId, friendId);
  }

  @Post('block/:userId')
  @HttpCode(HttpStatus.CREATED)
  async blockUser(
    @Request() req: any,
    @Param('userId') userId: string
  ) {
    const currentUserId = getUserId(req);
    return this.friendsService.blockUser(currentUserId, userId);
  }

  @Delete('unblock/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblockUser(
    @Request() req: any,
    @Param('userId') userId: string
  ) {
    const currentUserId = getUserId(req);
    await this.friendsService.unblockUser(currentUserId, userId);
  }

  @Get()
  async getFriends(
    @Request() req: any,
    @Query('status') status?: 'pending' | 'accepted' | 'blocked'
  ) {
    const userId = getUserId(req);
    return this.friendsService.getFriends(userId, status);
  }

  @Get('requests')
  async getFriendRequests(
    @Request() req: any,
    @Query('type') type?: 'sent' | 'received'
  ) {
    const userId = getUserId(req);
    return this.friendsService.getFriendRequests(userId, type);
  }

  @Get('status/:userId')
  async getFriendshipStatus(
    @Request() req: any,
    @Param('userId') userId: string
  ) {
    const currentUserId = getUserId(req);
    return this.friendsService.getFriendshipStatus(currentUserId, userId);
  }

  @Get('search')
  async searchUsers(
    @Request() req: any,
    @Query('q') query: string,
    @Query('limit') limit?: number
  ) {
    const userId = getUserId(req);
    return this.friendsService.searchUsers(query, userId, limit);
  }

  @Get('activity')
  async getFriendsActivity(
    @Request() req: any,
    @Query('limit') limit?: number
  ) {
    const userId = getUserId(req);
    const friendIds = await this.friendsService.getFriendIds(userId);
    return this.userActivityService.getFriendsActivity(userId, friendIds, limit);
  }
}
