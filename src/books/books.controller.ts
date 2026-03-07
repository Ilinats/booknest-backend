import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BooksService } from './books.service';
import { FilesService } from '../files/files.service';
import { JwtAuthGuard, RolesGuard, OptionalJwtAuthGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { UserType } from '../users/enums';
import {
  CreateBookDto,
  UpdateBookDto,
  BrowseBooksDto,
  CreateBookWithFilesDto,
  FindMyBooksDto,
  GetAuthorAnalyticsDto,
} from './dto';
import { Book } from './entity/book.entity';
import { BasePaginationDto } from '../common';
import { Paginate, PaginateQuery } from 'nestjs-paginate';
import { BookErrors } from './errors/book-errors';

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly filesService: FilesService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new book with file and optional cover (Author only)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateBookWithFilesDto })
  @ApiResponse({
    status: 201,
    description: 'Book created successfully',
    type: Book,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateBookDto,
  ) {
    return this.booksService.createWithFile(
      user.sub,
      user.userType as UserType,
      dto,
      file,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Post(':bookId/upload')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload book file (Author only)' })
  @ApiResponse({ status: 200, description: 'File uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.booksService.uploadBookFile(
      user.sub,
      user.userType,
      bookId,
      file,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Post(':bookId/cover')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload book cover image (Author only)' })
  @ApiResponse({
    status: 200,
    description: 'Cover image uploaded successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @UseInterceptors(
    FileInterceptor('cover', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadCover(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.booksService.uploadCoverImage(
      user.sub,
      user.userType,
      bookId,
      file,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Post(':bookId/publish')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a book (Author only)' })
  @ApiResponse({
    status: 200,
    description: 'Book published successfully',
    type: Book,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @ApiResponse({ status: 404, description: 'Book not found' })
  publish(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    return this.booksService.publish(
      user.sub,
      user.userType as UserType,
      bookId,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Browse books with advanced filters and pagination (Public)',
  })
  @ApiQuery({ type: () => BrowseBooksDto })
  @ApiResponse({ status: 200, description: 'Paginated list of books' })
  browse(
    @Paginate() query: PaginateQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    return this.booksService.browse(query, user?.sub, user?.userType as UserType);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current author's books" })
  @ApiResponse({
    status: 200,
    description: "List of author's books",
    type: [Book],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @ApiQuery({ type: () => FindMyBooksDto })
  my(
    @CurrentUser('sub') authorId: string,
    @Paginate() query: PaginateQuery,
  ) {
    return this.booksService.findMy(authorId, query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured books' })
  @ApiResponse({
    status: 200,
    description: 'List of featured books',
    type: [Book],
  })
  featured() {
    return this.booksService.featured();
  }

  @Get('trending')
  @ApiOperation({
    summary: 'Get trending books - most applied-for books in the last 7 days',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of books to return (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of trending books with application counts',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          book: { $ref: '#/components/schemas/Book' },
          applicationCount: { type: 'number' },
        },
      },
    },
  })
  trending(
    @CurrentUser() user: JwtPayload | undefined,
    @Query('limit') limit?: number,
  ) {
    const limitNum = limit ? parseInt(limit.toString(), 10) : undefined;
    return this.booksService.trending(
      limitNum && limitNum > 0 ? { limit: limitNum } : undefined,
      user?.sub,
      user?.userType as UserType,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommended')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recommended books for current user' })
  @ApiQuery({ type: () => BasePaginationDto })
  @ApiResponse({ status: 200, description: 'Paginated recommended books' })
  recommended(
    @CurrentUser() user: JwtPayload,
    @Paginate() query: PaginateQuery,
  ) {
    return this.booksService.recommendedForUser(
      user.sub,
      query,
      user.userType as UserType,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get('analytics/author')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get author analytics (Author only)' })
  @ApiQuery({ type: () => GetAuthorAnalyticsDto })
  @ApiResponse({ status: 200, description: 'Author analytics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getAuthorAnalytics(
    @CurrentUser('sub') authorId: string,
    @Query() dto: GetAuthorAnalyticsDto,
  ) {
    return this.booksService.getAuthorAnalytics(authorId, dto.dateRange);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get('analytics/performance-comparison')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get book performance comparison (Author only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Book performance comparison data',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  getBookPerformanceComparison(@CurrentUser('sub') authorId: string) {
    return this.booksService.getBookPerformanceComparison(authorId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookId/download')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get download URL for a book (Requires approved application)',
  })
  @ApiResponse({
    status: 200,
    description: 'Download URL generated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Approved application required',
  })
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    const hasApprovedApplication =
      await this.booksService.checkUserApplicationStatus(user.sub, bookId);
    if (!hasApprovedApplication) {
      throw new ForbiddenException(BookErrors.BOOK_NO_COPIES_AVAILABLE);
    }

    const book = await this.booksService.findOnePublic(
      bookId,
      user.sub,
      user.userType as UserType,
    );

    if (!book.fileUrl) {
      throw new BadRequestException(BookErrors.BOOK_FILE_NOT_AVAILABLE);
    }

    const fileKey = book.fileUrl.split('/').slice(-2).join('/');

    const downloadUrl = await this.filesService.getFileDownloadUrl(fileKey);

    return {
      downloadUrl,
      expiresIn: 3600,
      fileName: book.title,
      fileSize: book.fileSize,
      fileType: book.fileType,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get(':bookId/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get book statistics (Author only)' })
  @ApiResponse({ status: 200, description: 'Book statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  stats(
    @CurrentUser('sub') authorId: string,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    return this.booksService.stats(authorId, bookId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get(':bookId/analytics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get book analytics (Author only)' })
  @ApiResponse({ status: 200, description: 'Book analytics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  analytics(
    @CurrentUser('sub') authorId: string,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    return this.booksService.analytics(authorId, bookId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get(':bookId/analytics/detailed')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed book analytics (Author only)' })
  @ApiResponse({ status: 200, description: 'Detailed book analytics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  getDetailedBookAnalytics(
    @CurrentUser('sub') authorId: string,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    return this.booksService.analytics(authorId, bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookId/reviews/all')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get reviews for a book - Authors see all reviews, Readers see only their own',
  })
  @ApiQuery({ type: () => BasePaginationDto })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of reviews (all for authors, own for readers)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getBookAllReviews(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @Paginate() query: PaginateQuery,
  ) {
    return this.booksService.getBookAllReviews(
      user.sub,
      user.userType as UserType,
      bookId,
      query,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':bookId')
  @ApiOperation({ summary: 'Get book by ID' })
  @ApiResponse({ status: 200, description: 'Book details', type: Book })
  @ApiResponse({ status: 404, description: 'Book not found' })
  getOne(
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    return this.booksService.findOnePublic(
      bookId,
      user?.sub,
      user?.userType as UserType,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Patch(':bookId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a book (Author only)' })
  @ApiResponse({
    status: 200,
    description: 'Book updated successfully',
    type: Book,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @ApiResponse({ status: 404, description: 'Book not found' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @Body() dto: UpdateBookDto,
  ) {
    return this.booksService.update(
      user.sub,
      user.userType as UserType,
      bookId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Delete(':bookId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a book (Author only)' })
  @ApiResponse({ status: 200, description: 'Book deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @ApiResponse({ status: 404, description: 'Book not found' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    return this.booksService.remove(
      user.sub,
      user.userType as UserType,
      bookId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Delete(':bookId/cover')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove book cover image (Author only)' })
  @ApiResponse({
    status: 200,
    description: 'Cover image removed successfully',
    type: Book,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async removeCover(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    return this.booksService.removeCoverImage(user.sub, user.userType, bookId);
  }
}
