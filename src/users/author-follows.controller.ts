import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Param, 
  Query, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthorFollowService } from './author-follow.service';
import { FollowAuthorDto, UnfollowAuthorDto } from './dto/author-follow.dto';
import { getUserId } from '../common/get-user-id.util';

@Controller('authors')
@UseGuards(JwtAuthGuard)
export class AuthorFollowsController {
  constructor(
    private readonly authorFollowService: AuthorFollowService,
  ) {}

  @Post('follow/:username')
  async followAuthor(
    @Request() req: any,
    @Param('username') username: string
  ) {
    const userId = getUserId(req);
    return this.authorFollowService.followAuthor(userId, username);
  }

  @Delete('unfollow/:authorId')
  async unfollowAuthor(
    @Request() req: any,
    @Param('authorId') authorId: string
  ) {
    const userId = getUserId(req);
    await this.authorFollowService.unfollowAuthor(userId, authorId);
  }

  @Get('following')
  async getFollowedAuthors(@Request() req: any) {
    const userId = getUserId(req);
    return this.authorFollowService.getFollowedAuthors(userId);
  }

  @Get('following/with-stats')
  async getFollowedAuthorsWithStats(@Request() req: any) {
    const userId = getUserId(req);
    return this.authorFollowService.getFollowedAuthorsWithStats(userId);
  }

  @Get('followers/:authorId')
  async getAuthorFollowers(@Param('authorId') authorId: string) {
    return this.authorFollowService.getAuthorFollowers(authorId);
  }

  @Get('following/check/:authorId')
  async isFollowing(
    @Request() req: any,
    @Param('authorId') authorId: string
  ) {
    const userId = getUserId(req);
    return { isFollowing: await this.authorFollowService.isFollowing(userId, authorId) };
  }

  @Get('following/books')
  async getBooksFromFollowedAuthors(
    @Request() req: any,
    @Query('limit') limit?: number
  ) {
    const userId = getUserId(req);
    return this.authorFollowService.getBooksFromFollowedAuthors(userId, limit);
  }
}
