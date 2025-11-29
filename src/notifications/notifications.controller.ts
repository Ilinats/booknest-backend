import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { getUserId } from '../common/get-user-id.util';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const userId = getUserId(req);
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const unreadOnlyBool = unreadOnly === 'true';

    return this.notificationService.getUserNotifications(
      userId,
      limitNum,
      offsetNum,
      unreadOnlyBool,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const userId = getUserId(req);
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Put(':notificationId/read')
  async markAsRead(
    @Request() req: any,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    const userId = getUserId(req);
    return this.notificationService.markAsRead(notificationId, userId);
  }

  @Put('read-all')
  async markAllAsRead(@Request() req: any) {
    const userId = getUserId(req);
    await this.notificationService.markAllAsRead(userId);
    return { success: true, message: 'All notifications marked as read' };
  }

  @Delete(':notificationId')
  async deleteNotification(
    @Request() req: any,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    const userId = getUserId(req);
    await this.notificationService.deleteNotification(notificationId, userId);
    return { success: true, message: 'Notification deleted' };
  }
}

