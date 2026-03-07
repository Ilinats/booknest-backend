import { Logger } from '@nestjs/common';
import { ApplicationNotificationHelper } from './application-notification.helper';
import { Application } from '../entity/application.entity';
import { ApplicationStatus } from '../enums';
import { IApplicationNotificationService } from '../interfaces/notification-service.interface';

describe('ApplicationNotificationHelper', () => {
  let logger: Logger;
  let notificationService: jest.Mocked<IApplicationNotificationService>;

  beforeEach(() => {
    logger = { error: jest.fn() } as unknown as Logger;
    notificationService = {
      notifyApplicationApproved: jest.fn().mockResolvedValue(undefined),
      notifyApplicationRejected: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('sendStatusNotification', () => {
    it('returns without calling service when notificationService is undefined', async () => {
      const app = {
        id: 'app-1',
        readerId: 'r1',
        bookId: 'b1',
        status: ApplicationStatus.APPROVED,
      } as Application;

      await ApplicationNotificationHelper.sendStatusNotification(
        undefined,
        app,
        'Book Title',
        logger,
      );

      expect(notificationService.notifyApplicationApproved).not.toHaveBeenCalled();
      expect(notificationService.notifyApplicationRejected).not.toHaveBeenCalled();
    });

    it('calls notifyApplicationApproved when status is APPROVED', async () => {
      const app = {
        id: 'app-1',
        readerId: 'r1',
        bookId: 'b1',
        status: ApplicationStatus.APPROVED,
      } as Application;

      await ApplicationNotificationHelper.sendStatusNotification(
        notificationService,
        app,
        'Book Title',
        logger,
      );

      expect(notificationService.notifyApplicationApproved).toHaveBeenCalledWith(
        'r1',
        'b1',
        'Book Title',
        'app-1',
      );
      expect(notificationService.notifyApplicationRejected).not.toHaveBeenCalled();
    });

    it('calls notifyApplicationRejected when status is REJECTED', async () => {
      const app = {
        id: 'app-1',
        readerId: 'r1',
        bookId: 'b1',
        status: ApplicationStatus.REJECTED,
      } as Application;

      await ApplicationNotificationHelper.sendStatusNotification(
        notificationService,
        app,
        'Book Title',
        logger,
      );

      expect(notificationService.notifyApplicationRejected).toHaveBeenCalledWith(
        'r1',
        'b1',
        'Book Title',
        'app-1',
      );
      expect(notificationService.notifyApplicationApproved).not.toHaveBeenCalled();
    });

    it('does not call service for PENDING status', async () => {
      const app = {
        id: 'app-1',
        readerId: 'r1',
        bookId: 'b1',
        status: ApplicationStatus.PENDING,
      } as Application;

      await ApplicationNotificationHelper.sendStatusNotification(
        notificationService,
        app,
        'Book Title',
        logger,
      );

      expect(notificationService.notifyApplicationApproved).not.toHaveBeenCalled();
      expect(notificationService.notifyApplicationRejected).not.toHaveBeenCalled();
    });

    it('logs error and does not throw when notifyApplicationApproved rejects', async () => {
      notificationService.notifyApplicationApproved.mockRejectedValue(
        new Error('send failed'),
      );
      const app = {
        id: 'app-1',
        readerId: 'r1',
        bookId: 'b1',
        status: ApplicationStatus.APPROVED,
      } as Application;

      await expect(
        ApplicationNotificationHelper.sendStatusNotification(
          notificationService,
          app,
          'Book Title',
          logger,
        ),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send approval notification:',
        expect.any(String),
      );
    });

    it('logs error for rejection notification failure', async () => {
      notificationService.notifyApplicationRejected.mockRejectedValue(
        new Error('reject failed'),
      );
      const app = {
        id: 'app-1',
        readerId: 'r1',
        bookId: 'b1',
        status: ApplicationStatus.REJECTED,
      } as Application;

      await ApplicationNotificationHelper.sendStatusNotification(
        notificationService,
        app,
        'Book Title',
        logger,
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send rejection notification:',
        expect.any(String),
      );
    });

    it('logs error with raw value when thrown value is not an Error instance', async () => {
      notificationService.notifyApplicationApproved.mockRejectedValue('string error');
      const app = {
        id: 'app-1',
        readerId: 'r1',
        bookId: 'b1',
        status: ApplicationStatus.APPROVED,
      } as Application;

      await ApplicationNotificationHelper.sendStatusNotification(
        notificationService,
        app,
        'Book Title',
        logger,
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send approval notification:',
        'string error',
      );
    });
  });

  describe('sendBulkStatusNotifications', () => {
    it('returns without calling when notificationService is undefined', async () => {
      await ApplicationNotificationHelper.sendBulkStatusNotifications(
        undefined,
        [{ id: 'app-1' } as Application],
        'Title',
        logger,
      );

      expect(notificationService.notifyApplicationApproved).not.toHaveBeenCalled();
    });

    it('calls sendStatusNotification for each application', async () => {
      const app1 = {
        id: 'app-1',
        readerId: 'r1',
        bookId: 'b1',
        status: ApplicationStatus.APPROVED,
      } as Application;
      const app2 = {
        id: 'app-2',
        readerId: 'r2',
        bookId: 'b1',
        status: ApplicationStatus.REJECTED,
      } as Application;

      await ApplicationNotificationHelper.sendBulkStatusNotifications(
        notificationService,
        [app1, app2],
        'Book Title',
        logger,
      );

      expect(notificationService.notifyApplicationApproved).toHaveBeenCalledWith(
        'r1',
        'b1',
        'Book Title',
        'app-1',
      );
      expect(notificationService.notifyApplicationRejected).toHaveBeenCalledWith(
        'r2',
        'b1',
        'Book Title',
        'app-2',
      );
    });
  });
});
