import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entity/notification.entity';
import { NotificationTypeEnum } from './enums';
import { DeviceTokenService } from './device-token.service';
import { FirebaseNotificationService } from './firebase-notification.service';
import { UserProfileService } from '../user-profile/user-profile.service';
import { createPaginatedResponse } from '../common/utils/pagination.util';
import { NotificationErrorCode } from './errors';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly firebaseNotificationService: FirebaseNotificationService,
    private readonly userProfileService: UserProfileService,
  ) {}

  async createAndSendNotification(
    userId: string,
    type: NotificationTypeEnum,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<Notification | null> {
    const profile = await this.userProfileService.getProfile(userId);
    if (!profile.notificationsEnabled) {
      this.logger.log(`Notifications disabled for user ${userId}, skipping`);
      return null;
    }

    const preferences = profile.notificationPreferences || [];

    if (preferences.length > 0 && !preferences.includes(type)) {
      this.logger.log(
        `Notification type ${type} disabled for user ${userId}, skipping`,
      );
      return null;
    }

    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      body,
      data: data || {},
      bookId: data?.bookId,
      applicationId: data?.applicationId,
      relatedUserId: data?.relatedUserId,
      isRead: false,
    });

    const savedNotification =
      await this.notificationRepository.save(notification);

    try {
      const tokens = await this.deviceTokenService.getActiveTokens(userId);
      this.logger.log(
        `Found ${tokens.length} active device token(s) for user ${userId}`,
      );

      if (tokens.length > 0) {
        const result =
          await this.firebaseNotificationService.sendNotificationToMultiple(
            tokens,
            {
              title,
              body,
              data: {
                notificationId: savedNotification.id,
                type,
                ...data,
              },
            },
          );
        this.logger.log(
          `Push notification sent: ${result.success} successful, ${result.failure} failed`,
        );
      } else {
        this.logger.warn(
          `No active device tokens found for user ${userId}, notification saved but not sent as push`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send push notification: ${error}`,
        error?.stack,
      );
    }

    return savedNotification;
  }

  async getUserNotifications(
    userId: string,
    dto: { skip?: number; take?: number; unreadOnly?: boolean },
  ) {
    const skip = dto.skip ?? 0;
    const take = dto.take ?? 20;
    const unreadOnly = dto.unreadOnly ?? false;

    this.logger.log(
      `Getting notifications for user ${userId}, unreadOnly: ${unreadOnly}, type: ${typeof unreadOnly}`,
    );

    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');

    if (unreadOnly === true) {
      this.logger.log('Filtering to unread notifications only');
      query.andWhere('notification.isRead = :isRead', { isRead: false });
    } else {
      this.logger.log('Returning all notifications (read and unread)');
    }

    const [notifications, total] = await query
      .skip(skip)
      .take(take)
      .getManyAndCount();

    this.logger.log(
      `Found ${notifications.length} notifications (total: ${total})`,
    );

    return createPaginatedResponse(notifications, total, skip, take);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException(NotificationErrorCode.NOTIFICATION_NOT_FOUND);
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      return this.notificationRepository.save(notification);
    }

    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    await this.notificationRepository.delete({ id: notificationId, userId });
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await this.notificationRepository.delete({ userId });
  }

  async notifyFriendRequestReceived(
    recipientId: string,
    requesterId: string,
    requesterName: string,
  ): Promise<Notification | null> {
    return this.createAndSendNotification(
      recipientId,
      NotificationTypeEnum.FRIEND_REQUEST_RECEIVED,
      'New Friend Request',
      `${requesterName} sent you a friend request`,
      { relatedUserId: requesterId },
    );
  }

  async notifyFriendRequestAccepted(
    requesterId: string,
    accepterId: string,
    accepterName: string,
  ): Promise<Notification | null> {
    return this.createAndSendNotification(
      requesterId,
      NotificationTypeEnum.FRIEND_REQUEST_ACCEPTED,
      'Friend Request Accepted',
      `${accepterName} accepted your friend request`,
      { relatedUserId: accepterId },
    );
  }

  async notifyFriendRequestDeclined(
    requesterId: string,
    declinerId: string,
    declinerName: string,
  ): Promise<Notification | null> {
    return this.createAndSendNotification(
      requesterId,
      NotificationTypeEnum.FRIEND_REQUEST_DECLINED,
      'Friend Request Declined',
      `${declinerName} declined your friend request`,
      { relatedUserId: declinerId },
    );
  }

  async notifyYouAcceptedFriendRequest(
    accepterId: string,
    requesterId: string,
    requesterName: string,
  ): Promise<Notification | null> {
    return this.createAndSendNotification(
      accepterId,
      NotificationTypeEnum.FRIEND_REQUEST_ACCEPTED,
      'Friend Request Accepted',
      `You accepted ${requesterName}'s friend request`,
      { relatedUserId: requesterId },
    );
  }

  async notifyYouDeclinedFriendRequest(
    declinerId: string,
    requesterId: string,
    requesterName: string,
  ): Promise<Notification | null> {
    return this.createAndSendNotification(
      declinerId,
      NotificationTypeEnum.FRIEND_REQUEST_DECLINED,
      'Friend Request Declined',
      `You declined ${requesterName}'s friend request`,
      { relatedUserId: requesterId },
    );
  }

  async notifyApplicationApproved(
    readerId: string,
    bookId: string,
    bookTitle: string,
    applicationId: string,
  ): Promise<Notification | null> {
    return this.createAndSendNotification(
      readerId,
      NotificationTypeEnum.APPLICATION_APPROVED,
      'Application Approved!',
      `Your application for "${bookTitle}" has been approved`,
      { bookId, applicationId },
    );
  }

  async notifyApplicationRejected(
    readerId: string,
    bookId: string,
    bookTitle: string,
    applicationId: string,
  ): Promise<Notification | null> {
    return this.createAndSendNotification(
      readerId,
      NotificationTypeEnum.APPLICATION_REJECTED,
      'Application Update',
      `Your application for "${bookTitle}" was not approved`,
      { bookId, applicationId },
    );
  }

  async notifyReviewDeadlineReminder(
    readerId: string,
    bookId: string,
    bookTitle: string,
    applicationId: string,
    daysUntilDeadline: number,
  ): Promise<Notification | null> {
    const dayText = daysUntilDeadline === 1 ? 'day' : 'days';
    return this.createAndSendNotification(
      readerId,
      NotificationTypeEnum.REVIEW_DEADLINE_REMINDER,
      'Review Deadline Reminder',
      `You have ${daysUntilDeadline} ${dayText} left to submit your review for "${bookTitle}"`,
      { bookId, applicationId, daysUntilDeadline },
    );
  }

  async notifyAuthorBookPublished(
    followerId: string,
    authorId: string,
    authorName: string,
    bookId: string,
    bookTitle: string,
  ): Promise<Notification | null> {
    return this.createAndSendNotification(
      followerId,
      NotificationTypeEnum.AUTHOR_BOOK_PUBLISHED,
      'New Book Published',
      `${authorName} published a new book: "${bookTitle}"`,
      { bookId, authorId, relatedUserId: authorId },
    );
  }
}
