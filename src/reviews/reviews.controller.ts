import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
  UseGuards,
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
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard, RolesGuard, OptionalJwtAuthGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { FindReviewsDto } from './dto/find-reviews.dto';
import { BasePaginationDto } from '../common';
import { UserType } from '../users/enums';
import { Review } from './entity/review.entity';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review (Authenticated)' })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@CurrentUser('sub') readerId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(readerId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get('author/latest')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get latest reviews across all books (Author only)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of reviews to return (default: 3)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of latest reviews across all author books',
    type: [Review],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  getAuthorLatestReviews(
    @CurrentUser('sub') authorId: string,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getAuthorLatestReviews(
      authorId,
      limit ? parseInt(limit.toString(), 10) : 3,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':reviewId')
  @ApiOperation({
    summary:
      'Get review by ID (Public - optional authentication for private reviews)',
  })
  @ApiResponse({ status: 200, description: 'Review details' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  @ApiResponse({ status: 403, description: 'Access denied for private review' })
  findOne(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
  ) {
    return this.reviewsService.findOne(reviewId, user?.sub, user?.userType);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my/book/:bookId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get current user's review for a specific book (Authenticated)",
  })
  @ApiResponse({
    status: 200,
    description: "User's review for the book (null if not found)",
    type: Review,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyReviewForBook(
    @CurrentUser('sub') userId: string,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    return this.reviewsService.findUserReviewForBook(bookId, userId);
  }

  @Get('books/:bookId')
  @ApiOperation({
    summary:
      'Get reviews for a book (Public - optional authentication for private reviews)',
  })
  @ApiQuery({ type: () => FindReviewsDto })
  @ApiResponse({ status: 200, description: 'Paginated list of reviews' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getBookReviews(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @Query() dto: FindReviewsDto,
  ) {
    return this.reviewsService.getBookReviews(
      bookId,
      dto,
      user?.sub,
      user?.userType,
    );
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get reviews by a user (Public)' })
  @ApiQuery({ type: () => FindReviewsDto })
  @ApiResponse({ status: 200, description: 'Paginated list of reviews' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getUserReviews(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() dto: FindReviewsDto,
  ) {
    return this.reviewsService.getUserReviews(userId, dto);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured reviews (Public)' })
  @ApiQuery({ type: () => BasePaginationDto })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of featured reviews',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getFeaturedReviews(@Query() dto: BasePaginationDto) {
    return this.reviewsService.getFeaturedReviews(dto);
  }
  @UseGuards(JwtAuthGuard)
  @Patch(':reviewId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a review (Authenticated)' })
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your review' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() dto: UpdateReviewDto & { isFeatured?: boolean },
  ) {
    return this.reviewsService.update(reviewId, user.sub, user.userType, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':reviewId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review (Authenticated)' })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your review' })
  remove(
    @CurrentUser('sub') readerId: string,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
  ) {
    return this.reviewsService.remove(reviewId, readerId);
  }
}
