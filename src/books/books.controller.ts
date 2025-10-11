import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBookDto) {
    return this.booksService.create(user.sub, user.userType as any, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  my(@CurrentUser('sub') authorId: string) {
    return this.booksService.findMy(authorId);
  }

  @Get('featured')
  featured() {
    return this.booksService.featured();
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommended')
  recommended(
    @CurrentUser('sub') userId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const parsed = {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : 20,
    };
    return this.booksService.recommendedForUser(userId, parsed);
  }

  @Get('search')
  search(@Query('q') q?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.browse(q, undefined, undefined, undefined, undefined, undefined, undefined, skip, take);
  }

  @Get(':bookId')
  getOne(@Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return this.booksService.findOnePublic(bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':bookId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(@CurrentUser() user: JwtPayload, @Param('bookId', new ParseUUIDPipe()) bookId: string, @Body() dto: UpdateBookDto) {
    return this.booksService.update(user.sub, user.userType as any, bookId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':bookId')
  remove(@CurrentUser() user: JwtPayload, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return this.booksService.remove(user.sub, user.userType as any, bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':bookId/publish')
  publish(@CurrentUser() user: JwtPayload, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return this.booksService.publish(user.sub, user.userType as any, bookId);
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  browse(
    @Query('search') search?: string,
    @Query('genreId') genreId?: string,
    @Query('status') status?: 'draft' | 'active' | 'in_progress' | 'completed' | 'archived',
    @Query('ageRating') ageRating?: 'all' | '13+' | '16+' | '18+',
    @Query('distributionType') distributionType?: 'physical' | 'digital' | 'both',
    @Query('publishedFrom') publishedFrom?: string,
    @Query('publishedTo') publishedTo?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const parsed = {
      search: search || undefined,
      genreId: genreId ? parseInt(genreId, 10) : undefined,
      status: status || undefined,
      ageRating: ageRating || undefined,
      distributionType: distributionType || undefined,
      publishedFrom: publishedFrom || undefined,
      publishedTo: publishedTo || undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    };
    return this.booksService.browse(parsed);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':bookId/upload')
  upload(@CurrentUser() user: JwtPayload, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return { message: 'Upload endpoint not implemented yet', bookId };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookId/download')
  download(@CurrentUser() user: JwtPayload, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return { message: 'Download endpoint not implemented yet', bookId };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookId/stats')
  stats(@CurrentUser('sub') authorId: string, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return this.booksService.stats(authorId, bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookId/analytics')
  analytics(@CurrentUser('sub') authorId: string, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return this.booksService.analytics(authorId, bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookId/analytics/detailed')
  getDetailedBookAnalytics(@CurrentUser('sub') authorId: string, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return this.booksService.getBookAnalytics(bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('analytics/author')
  getAuthorAnalytics(@CurrentUser('sub') authorId: string) {
    return this.booksService.getAuthorAnalytics(authorId);
  }
}


