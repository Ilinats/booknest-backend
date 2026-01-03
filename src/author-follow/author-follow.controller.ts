import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthorFollowService } from './author-follow.service';
import { getUserId } from '../common';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { UserType } from '../users/enums';

@ApiTags('Author Follow')
@Controller('authors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuthorFollowController {
  constructor(private readonly authorFollowService: AuthorFollowService) {}

  @Post('follow/:authorId')
  @ApiOperation({ summary: 'Follow an author (Authenticated)' })
  @ApiResponse({ status: 201, description: 'Author followed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async followAuthor(@Request() req: any, @Param('authorId') authorId: string) {
    const userId = getUserId(req);
    return this.authorFollowService.followAuthor(userId, authorId);
  }

  @Get('following')
  @ApiOperation({ summary: 'Get followed authors (Authenticated)' })
  @ApiResponse({ status: 200, description: 'List of followed authors' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFollowedAuthors(@Request() req: any) {
    const userId = getUserId(req);
    return this.authorFollowService.getFollowedAuthors(userId);
  }

  @Get('following/with-stats')
  @ApiOperation({
    summary: 'Get followed authors with statistics (Authenticated)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of followed authors with stats',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFollowedAuthorsWithStats(@Request() req: any) {
    const userId = getUserId(req);
    return this.authorFollowService.getFollowedAuthorsWithStats(userId);
  }

  @Get('followers/:authorId')
  @ApiOperation({ summary: 'Get author followers (Authenticated)' })
  @ApiResponse({ status: 200, description: 'List of author followers' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAuthorFollowers(@Param('authorId') authorId: string) {
    return this.authorFollowService.getAuthorFollowers(authorId);
  }

  @Get('followers/:authorId/count')
  @ApiOperation({ summary: 'Get author followers count (Authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'Number of followers',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAuthorFollowersCount(@Param('authorId') authorId: string) {
    const count =
      await this.authorFollowService.getAuthorFollowersCount(authorId);
    return { count };
  }

  @Get('following/check/:authorId')
  @ApiOperation({ summary: 'Check if following an author (Authenticated)' })
  @ApiResponse({ status: 200, description: 'Following status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async isFollowing(@Request() req: any, @Param('authorId') authorId: string) {
    const userId = getUserId(req);
    return {
      isFollowing: await this.authorFollowService.isFollowing(userId, authorId),
    };
  }

  @Get('following/books')
  @ApiOperation({ summary: 'Get books from followed authors (Authenticated)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of books',
  })
  @ApiResponse({
    status: 200,
    description: 'List of books from followed authors',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBooksFromFollowedAuthors(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: number,
  ) {
    return this.authorFollowService.getBooksFromFollowedAuthors(
      user.sub,
      limit,
      user.userType as UserType,
    );
  }

  @Delete('unfollow/:authorId')
  @ApiOperation({ summary: 'Unfollow an author (Authenticated)' })
  @ApiResponse({ status: 200, description: 'Author unfollowed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unfollowAuthor(
    @Request() req: any,
    @Param('authorId') authorId: string,
  ) {
    const userId = getUserId(req);
    await this.authorFollowService.unfollowAuthor(userId, authorId);
  }
}
