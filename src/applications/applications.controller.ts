import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationStatusDto } from './dto/application-status.dto';
import { ApproveRejectApplicationDto } from './dto/approve-reject-application.dto';
import { BulkActionDto } from './dto/bulk-action.dto';
import { UpdateReadingStatusDto } from './dto/update-reading-status.dto';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@CurrentUser('sub') readerId: string, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(readerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  findMy(
    @CurrentUser('sub') readerId: string,
    @Query('status') status?: string
  ) {
    return this.applicationsService.findMyApplications(readerId, status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check/:bookId')
  checkApplication(
    @CurrentUser('sub') readerId: string,
    @Param('bookId', new ParseUUIDPipe()) bookId: string
  ) {
    return this.applicationsService.checkApplication(readerId, bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':applicationId')
  findOne(@CurrentUser() user: JwtPayload, @Param('applicationId', new ParseUUIDPipe()) applicationId: string) {
    return this.applicationsService.findOne(applicationId, user.sub, user.userType);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':applicationId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(
    @CurrentUser('sub') readerId: string,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    @Body() dto: UpdateApplicationDto
  ) {
    return this.applicationsService.update(applicationId, readerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':applicationId')
  withdraw(
    @CurrentUser('sub') readerId: string,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string
  ) {
    return this.applicationsService.withdraw(applicationId, readerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('books/:bookId')
  getBookApplications(
    @CurrentUser() user: JwtPayload,
    @Param('bookId', new ParseUUIDPipe()) bookId: string
  ) {
    return this.applicationsService.getBookApplications(bookId, user.sub, user.userType);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':applicationId/approve')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  approve(
    @CurrentUser() user: JwtPayload,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    @Body() dto: ApproveRejectApplicationDto
  ) {
    return this.applicationsService.updateApplicationStatus(applicationId, user.sub, user.userType, { ...dto, status: 'approved' });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':applicationId/reject')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    @Body() dto: ApproveRejectApplicationDto
  ) {
    return this.applicationsService.updateApplicationStatus(applicationId, user.sub, user.userType, { ...dto, status: 'rejected' });
  }

  @UseGuards(JwtAuthGuard)
  @Post('bulk-action')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  bulkAction(@CurrentUser() user: JwtPayload, @Body() dto: BulkActionDto) {
    return this.applicationsService.bulkAction(user.sub, user.userType, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':applicationId/mark-sent')
  markCopySent(
    @CurrentUser() user: JwtPayload,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string
  ) {
    return this.applicationsService.markCopySent(applicationId, user.sub, user.userType);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':applicationId/mark-received')
  markCopyReceived(
    @CurrentUser('sub') readerId: string,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string
  ) {
    return this.applicationsService.markCopyReceived(applicationId, readerId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':applicationId/reading-status')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateReadingStatus(
    @CurrentUser('sub') readerId: string,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    @Body() dto: UpdateReadingStatusDto
  ) {
    return this.applicationsService.updateReadingStatus(applicationId, readerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my/reading-progress')
  getMyReadingProgress(@CurrentUser('sub') readerId: string) {
    return this.applicationsService.getMyReadingProgress(readerId);
  }
}
