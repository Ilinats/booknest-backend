import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
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
import { BookErrorCode, BookErrors } from './errors/book-errors';

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
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  my(@CurrentUser('sub') authorId: string, @Query() dto: FindMyBooksDto) {
    return this.booksService.findMy(authorId, dto.sortBy);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get('approaching-deadline')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get books with approaching deadline (Author only)',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to look ahead (default: 7)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of books with approaching deadline',
    type: [Book],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  getBooksWithApproachingDeadline(
    @CurrentUser('sub') authorId: string,
    @Query('days') days?: number,
  ) {
    return this.booksService.getBooksWithApproachingDeadline(
      authorId,
      days ? parseInt(days.toString(), 10) : 7,
    );
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

  @Get('search/suggestions')
  @ApiOperation({
    summary: 'Get search suggestions for autocomplete',
    description:
      'Returns matching book titles, author names, and series names based on query',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search query string',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of suggestions per category (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Search suggestions grouped by category',
    schema: {
      type: 'object',
      properties: {
        books: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
          },
        },
        authors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
        series: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  })
  searchSuggestions(@Query('q') query: string, @Query('limit') limit?: number) {
    if (!query || query.trim().length === 0) {
      return { books: [], authors: [], series: [] };
    }
    const limitNum = limit ? parseInt(limit.toString(), 10) : 10;
    return this.booksService.searchSuggestions(
      query.trim(),
      limitNum > 0 ? limitNum : 10,
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
    @Query() pagination: BasePaginationDto,
  ) {
    const skip = pagination.skip ?? 0;
    const take = pagination.take ?? 20;
    return this.booksService.recommendedForUser(
      user.sub,
      { skip, take },
      user.userType as UserType,
    );
  }

  @Get('series/:seriesId')
  @ApiOperation({
    summary: 'Get all books in a series (Public)',
    description:
      'Returns all active books in a series, ordered by series order and publication date',
  })
  @ApiResponse({
    status: 200,
    description: 'List of books in the series',
    type: [Book],
  })
  getBySeries(@Param('seriesId', new ParseUUIDPipe()) seriesId: string) {
    return this.booksService.findBySeries(seriesId);
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

  @Get()
  @ApiOperation({
    summary: 'Browse books with advanced filters and pagination (Public)',
  })
  @ApiQuery({ type: () => BrowseBooksDto })
  @ApiResponse({ status: 200, description: 'Paginated list of books' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  browse(
    @Query() dto: BrowseBooksDto,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    return this.booksService.browse(dto, user?.sub, user?.userType as UserType);
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
      const error = BookErrors[BookErrorCode.BOOK_NO_COPIES_AVAILABLE];
      throw new ForbiddenException({
        message: 'Approved application required to download',
        code: error.code,
      });
    }

    const book = await this.booksService.findOnePublic(
      bookId,
      user.sub,
      user.userType as UserType,
    );

    if (!book.fileUrl) {
      const error = BookErrors[BookErrorCode.BOOK_FILE_NOT_AVAILABLE];
      throw new BadRequestException({
        message: error.message,
        code: error.code,
      });
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
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getBookAllReviews(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @Query() pagination: BasePaginationDto,
  ) {
    return this.booksService.getBookAllReviews(
      user.sub,
      user.userType as UserType,
      bookId,
      pagination,
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
