import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@CurrentUser('sub') readerId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(readerId, dto);
  }

  @Get(':reviewId')
  findOne(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string
  ) {
    return this.reviewsService.findOne(reviewId, user?.sub || '', user?.userType);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':reviewId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(
    @CurrentUser('sub') readerId: string,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() dto: UpdateReviewDto
  ) {
    return this.reviewsService.update(reviewId, readerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':reviewId')
  remove(
    @CurrentUser('sub') readerId: string,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string
  ) {
    return this.reviewsService.remove(reviewId, readerId);
  }

  @Get('books/:bookId')
  getBookReviews(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @Query('includePrivate') includePrivate?: string
  ) {
    const includePrivateFlag = includePrivate === 'true';
    return this.reviewsService.getBookReviews(
      bookId, 
      includePrivateFlag, 
      user?.sub, 
      user?.userType
    );
  }

  @Get('users/:userId')
  getUserReviews(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query('includePrivate') includePrivate?: string
  ) {
    const includePrivateFlag = includePrivate === 'true';
    return this.reviewsService.getUserReviews(userId, includePrivateFlag);
  }

  @Get('featured')
  getFeaturedReviews(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.reviewsService.getFeaturedReviews(limitNum);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':reviewId/feature')
  featureReview(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string
  ) {
    return this.reviewsService.featureReview(reviewId, user.sub, user.userType);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':reviewId/unfeature')
  unfeatureReview(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string
  ) {
    return this.reviewsService.unfeatureReview(reviewId, user.sub, user.userType);
  }
}
