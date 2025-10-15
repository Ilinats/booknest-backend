import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards, UsePipes, ValidationPipe, UseInterceptors, UploadedFile, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BooksService } from './books.service';
import { FilesService } from '../files/files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly filesService: FilesService,
  ) {}

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
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: JwtPayload, 
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const uploadResult = await this.filesService.uploadFile(file, 'books');
    
    const updatedBook = await this.booksService.updateFileInfo(
      user.sub, 
      user.userType as any, 
      bookId, 
      uploadResult.fileUrl,
      uploadResult.fileSize,
      uploadResult.fileType
    );

    return {
      success: true,
      message: 'File uploaded successfully',
      data: {
        book: updatedBook,
        file: {
          url: uploadResult.fileUrl,
          size: uploadResult.fileSize,
          type: uploadResult.fileType,
          originalName: file.originalname,
        },
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookId/download')
  async download(@CurrentUser() user: JwtPayload, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    const hasApprovedApplication = await this.booksService.checkUserApplicationStatus(user.sub, bookId);
    
    if (!hasApprovedApplication) {
      throw new ForbiddenException('You must have an approved application to download this book');
    }

    const book = await this.booksService.findOnePublic(bookId);
    
    if (!book.fileUrl) {
      throw new BadRequestException('No file available for this book');
    }

    const fileKey = book.fileUrl.split('/').slice(-2).join('/');
    
    const downloadUrl = await this.filesService.getFileDownloadUrl(fileKey);

    return {
      success: true,
      message: 'Download URL generated successfully',
      data: {
        downloadUrl,
        expiresIn: 3600, // 1 hour
        fileName: book.title,
        fileSize: book.fileSize,
        fileType: book.fileType,
      },
    };
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


