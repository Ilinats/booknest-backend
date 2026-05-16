import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Paginate, PaginateQuery } from 'nestjs-paginate';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { UserType } from '../users/enums';
import {
  CreateApplicationDto,
  BulkActionDto,
  BulkMarkSentDto,
  UpdateApplicationCompleteDto,
  UpdateReadingStatusDto,
} from './dto';
import { Application } from './entity';

@ApiTags('Applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.READER)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new application for a book (Reader only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Application created successfully',
    type: Application,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - email verification required or address required',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - reader access required, book not active or no copies available',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - application already exists',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(
    @CurrentUser('sub') readerId: string,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(readerId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Post('books/:bookId/bulk-mark-sent')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk mark copies as sent (Author only)' })
  @ApiResponse({ status: 200, description: 'Copies marked as sent' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  bulkMarkCopySent(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @Body() dto: BulkMarkSentDto,
  ) {
    return this.applicationsService.bulkMarkCopySent(
      bookId,
      user.sub,
      user.userType,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Post('books/:bookId/bulk-action')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Perform bulk action on applications (Author only)',
  })
  @ApiResponse({ status: 200, description: 'Bulk action completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  bulkAction(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @Body() dto: BulkActionDto,
  ) {
    return this.applicationsService.bulkUpdateApplicationStatus(
      bookId,
      user.sub,
      user.userType,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Post('books/:bookId/run-lottery')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Run lottery selection for a book (Author only)',
    description:
      'Randomly selects applications after deadline. Can only be run once per book.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lottery completed successfully',
    schema: {
      type: 'object',
      properties: {
        approved: { type: 'number' },
        rejected: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - deadline not passed or lottery already run',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  runLotterySelection(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    return this.applicationsService.runLotterySelection(bookId, user.sub);
  }
  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Get current user's applications with advanced filters (Authenticated)",
  })
  @ApiResponse({ status: 200, description: 'Paginated list of applications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findMy(
    @CurrentUser('sub') readerId: string,
    @Paginate() query: PaginateQuery,
  ) {
    return this.applicationsService.findMyApplications(readerId, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get('overdue-reviews')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get overdue reviews (Author only)' })
  @ApiResponse({
    status: 200,
    description: 'List of applications with overdue reviews',
    type: [Application],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  getOverdueReviews(@CurrentUser() user: JwtPayload) {
    return this.applicationsService.getOverdueReviews(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check/:bookId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check if user has applied for a book (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'Application check result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  checkApplication(
    @CurrentUser('sub') readerId: string,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    return this.applicationsService.checkApplication(readerId, bookId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get('books/:bookId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all applications for a book (Author only)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of applications for the book',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  getBookApplications(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @Paginate() query: PaginateQuery,
  ) {
    return this.applicationsService.getBookApplications(
      bookId,
      user.sub,
      query,
    );
  }
  @UseGuards(JwtAuthGuard)
  @Get(':applicationId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get application by ID (Authenticated - reader or author access)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application details',
    type: Application,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
  ) {
    return this.applicationsService.findOne(applicationId, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':applicationId')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update application - supports updating message, status (author), reading status (reader), and marking sent/received (Authenticated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application updated successfully',
    type: Application,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions or invalid state',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(
    @CurrentUser() user: JwtPayload,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    @Body() dto: UpdateApplicationCompleteDto,
  ) {
    return this.applicationsService.update(
      applicationId,
      user.sub,
      user.userType,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':applicationId/reading-status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update reading status (Authenticated - Reader only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Reading status updated successfully',
    type: Application,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - application not approved',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateReadingStatus(
    @CurrentUser('sub') readerId: string,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    @Body() dto: UpdateReadingStatusDto,
  ) {
    return this.applicationsService.updateReadingStatus(
      applicationId,
      readerId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Patch(':applicationId/mark-sent')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark copy as sent (Author only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Copy marked as sent successfully',
    type: Application,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Author access required or application not approved',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  markCopySent(
    @CurrentUser() user: JwtPayload,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
  ) {
    return this.applicationsService.markCopySent(
      applicationId,
      user.sub,
      user.userType,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':applicationId/mark-received')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark copy as received (Authenticated - Reader only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Copy marked as received successfully',
    type: Application,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - application not approved or not the applicant',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  markCopyReceived(
    @CurrentUser('sub') readerId: string,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
  ) {
    return this.applicationsService.markCopyReceived(applicationId, readerId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':applicationId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Withdraw application (Authenticated - pending applications only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application withdrawn successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - can only withdraw pending applications',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  withdraw(
    @CurrentUser('sub') readerId: string,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
  ) {
    return this.applicationsService.withdrawApplication(
      applicationId,
      readerId,
    );
  }
}
