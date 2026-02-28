import { Logger } from '@nestjs/common';
import { Application } from '../entity/application.entity';
import { ApplicationStatus } from '../enums';
import { IApplicationNotificationService } from '../interfaces/notification-service.interface';

export class ApplicationNotificationHelper {
  static async sendStatusNotification(
    notificationService: IApplicationNotificationService | undefined,
    application: Application,
    bookTitle: string,
    logger: Logger,
  ): Promise<void> {
    if (!notificationService) {
      return;
    }

    try {
      if (application.status === ApplicationStatus.APPROVED) {
        await notificationService.notifyApplicationApproved(
          application.readerId,
          application.bookId,
          bookTitle,
          application.id,
        );
      } else if (application.status === ApplicationStatus.REJECTED) {
        await notificationService.notifyApplicationRejected(
          application.readerId,
          application.bookId,
          bookTitle,
          application.id,
        );
      }
    } catch (error) {
      const status =
        application.status === ApplicationStatus.APPROVED
          ? 'approval'
          : 'rejection';
      logger.error(
        `Failed to send ${status} notification:`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  static async sendBulkStatusNotifications(
    notificationService: IApplicationNotificationService | undefined,
    applications: Application[],
    bookTitle: string,
    logger: Logger,
  ): Promise<void> {
    if (!notificationService) {
      return;
    }

    for (const app of applications) {
      await this.sendStatusNotification(
        notificationService,
        app,
        bookTitle,
        logger,
      );
    }
  }
}
