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
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { FindReviewsDto } from './dto/find-reviews.dto';

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
    return this.reviewsService.findOne(reviewId, user?.sub);
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

  @UseGuards(JwtAuthGuard)
  @Patch(':reviewId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a review (Authenticated)' })
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your review' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() dto: UpdateReviewDto,
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
