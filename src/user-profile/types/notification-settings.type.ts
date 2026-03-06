import { NotificationTypeEnum } from '../../notifications/enums/notification-type.enum';

export type NotificationSettings = {
  notificationsEnabled?: boolean;
  emailNotifications?: boolean;
  notificationPreferences?: NotificationTypeEnum[] | null;
};

