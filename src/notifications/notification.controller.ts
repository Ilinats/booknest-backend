import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { getUserId } from '../common';
import { FindNotificationsDto } from './dto/find-notifications.dto';
import { Request as ExpressRequest } from 'express';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications (Authenticated)' })
  @ApiQuery({ type: () => FindNotificationsDto })
  @ApiResponse({ status: 200, description: 'Paginated list of notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )
  async getNotifications(
    @Request() req: ExpressRequest,
    @Query() dto: FindNotificationsDto,
  ) {
    const userId = getUserId(req);
    return this.notificationService.getUserNotifications(userId, dto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count (Authenticated)' })
  @ApiResponse({ status: 200, description: 'Unread notification count' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@Request() req: ExpressRequest) {
    const userId = getUserId(req);
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark notification as read (Authenticated)' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsRead(
    @Request() req: ExpressRequest,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    const userId = getUserId(req);
    return this.notificationService.markAsRead(notificationId, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read (Authenticated)' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@Request() req: ExpressRequest) {
    const userId = getUserId(req);
    await this.notificationService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  @Delete('all')
  @ApiOperation({ summary: 'Delete all notifications (Authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'All notifications deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAllNotifications(@Request() req: ExpressRequest) {
    const userId = getUserId(req);
    await this.notificationService.deleteAllNotifications(userId);
    return { message: 'All notifications deleted' };
  }

  @Delete(':notificationId')
  @ApiOperation({ summary: 'Delete a notification (Authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteNotification(
    @Request() req: ExpressRequest,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    const userId = getUserId(req);
    await this.notificationService.deleteNotification(notificationId, userId);
    return { message: 'Notification deleted' };
  }
}
