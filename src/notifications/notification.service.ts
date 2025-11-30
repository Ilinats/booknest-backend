import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entity/notification.entity';
import { DeviceTokenService } from './device-token.service';
import { FirebaseNotificationService } from './firebase-notification.service';
import { UserProfileService } from '../users/user-profile.service';

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
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<Notification | null> {
    const profile = await this.userProfileService.getProfile(userId);
    if (!profile.notificationsEnabled) {
      this.logger.log(`Notifications disabled for user ${userId}, skipping`);
      return null;
    }

    const preferences = profile.notificationPreferences || {};
    const typePreferenceMap: Record<NotificationType, keyof typeof preferences> = {
      friend_request_received: 'friendRequests',
      friend_request_accepted: 'friendRequestAccepted',
      friend_request_declined: 'friendRequestAccepted', // Use same preference as accepted
      application_approved: 'applicationApproved',
      application_rejected: 'applicationRejected',
      review_deadline_reminder: 'reviewDeadlineReminders',
      author_book_published: 'authorBookPublished',
    };

    const preferenceKey = typePreferenceMap[type];
    if (preferenceKey && preferences[preferenceKey] === false) {
      this.logger.log(`Notification type ${type} disabled for user ${userId}, skipping`);
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

    const savedNotification = await this.notificationRepository.save(notification);

    try {
      const tokens = await this.deviceTokenService.getActiveTokens(userId);
      this.logger.log(`Found ${tokens.length} active device token(s) for user ${userId}`);
      
      if (tokens.length > 0) {
        const result = await this.firebaseNotificationService.sendNotificationToMultiple(tokens, {
          title,
          body,
          data: {
            notificationId: savedNotification.id,
            type,
            ...data,
          },
        });
        this.logger.log(`Push notification sent: ${result.success} successful, ${result.failure} failed`);
      } else {
        this.logger.warn(`No active device tokens found for user ${userId}, notification saved but not sent as push`);
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error}`, error?.stack);
    }

    return savedNotification;
  }

  async getUserNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    unreadOnly: boolean = false,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');

    if (unreadOnly) {
      query.andWhere('notification.isRead = :isRead', { isRead: false });
    }

    const [notifications, total] = await query
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { notifications, total };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
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

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.delete({ id: notificationId, userId });
  }

  async notifyFriendRequestReceived(
    recipientId: string,
    requesterId: string,
    requesterName: string,
  ): Promise<Notification | null> {
    return this.createAndSendNotification(
      recipientId,
      'friend_request_received',
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
      'friend_request_accepted',
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
      'friend_request_declined',
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
      'friend_request_accepted',
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
      'friend_request_declined',
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
      'application_approved',
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
      'application_rejected',
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
      'review_deadline_reminder',
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
      'author_book_published',
      'New Book Published',
      `${authorName} published a new book: "${bookTitle}"`,
      { bookId, authorId, relatedUserId: authorId },
    );
  }
}

