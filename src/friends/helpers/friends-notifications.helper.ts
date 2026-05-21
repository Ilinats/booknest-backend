import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { NotificationService } from '../../notifications/notification.service';

@Injectable()
export class FriendsNotificationsHelper {
  private readonly logger = new Logger(FriendsNotificationsHelper.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional()
    @Inject('NotificationService')
    private readonly notificationService?: NotificationService,
  ) {}

  async notifyFriendRequestReceived(
    recipientId: string,
    requesterId: string,
  ): Promise<void> {
    const requesterName = await this.getUserFullNameOrDefault(requesterId);

    await this.safeNotify(
      (service) =>
        service.notifyFriendRequestReceived(
          recipientId,
          requesterId,
          requesterName,
        ),
      `Friend request for user ${recipientId}`,
    );
  }

  async notifyFriendRequestAccepted(
    requesterId: string,
    accepterId: string,
  ): Promise<void> {
    const accepterName = await this.getUserFullNameOrDefault(accepterId);

    await this.safeNotify(
      (service) =>
        service.notifyFriendRequestAccepted(
          requesterId,
          accepterId,
          accepterName,
        ),
      `Friend request accepted for requester ${requesterId}`,
    );

    const requesterName = await this.getUserFullNameOrDefault(requesterId);

    await this.safeNotify(
      (service) =>
        service.notifyYouAcceptedFriendRequest(
          accepterId,
          requesterId,
          requesterName,
        ),
      `You accepted friend request for accepter ${accepterId}`,
    );
  }

  async notifyFriendRequestDeclined(
    requesterId: string,
    declinerId: string,
  ): Promise<void> {
    const declinerName = await this.getUserFullNameOrDefault(declinerId);

    await this.safeNotify(
      (service) =>
        service.notifyFriendRequestDeclined(
          requesterId,
          declinerId,
          declinerName,
        ),
      `Friend request declined for requester ${requesterId}`,
    );

    const requesterName = await this.getUserFullNameOrDefault(requesterId);

    await this.safeNotify(
      (service) =>
        service.notifyYouDeclinedFriendRequest(
          declinerId,
          requesterId,
          requesterName,
        ),
      `You declined friend request for decliner ${declinerId}`,
    );
  }

  private async getUserFullNameOrDefault(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return 'Someone';
    }

    return `${user.firstName} ${user.lastName}`;
  }

  private async safeNotify(
    notify: (service: NotificationService) => Promise<unknown | null>,
    context: string,
  ): Promise<void> {
    if (!this.notificationService) {
      this.logger.warn('NotificationService not available');
      return;
    }

    try {
      const notification = await notify(this.notificationService);

      if (notification) {
        this.logger.debug(`${context} notification created`);
      } else {
        this.logger.debug(
          `${context} notification skipped (likely due to preferences)`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to send ${context} notification`, error);
    }
  }
}
