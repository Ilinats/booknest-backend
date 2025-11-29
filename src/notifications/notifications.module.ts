import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entity/device-token.entity';
import { Notification } from './entity/notification.entity';
import { DeviceTokenService } from './device-token.service';
import { DeviceTokenController } from './device-token.controller';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { FirebaseNotificationService } from './firebase-notification.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { Book } from '../books/entity/book.entity';
import { Application } from '../applications/entity/application.entity';
import { User } from '../users/entity/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceToken, Notification, Book, Application, User]),
    forwardRef(() => UsersModule),
    AuthModule,
  ],
  providers: [
    DeviceTokenService,
    NotificationService,
    FirebaseNotificationService,
    {
      provide: 'NotificationService',
      useExisting: NotificationService,
    },
  ],
  controllers: [DeviceTokenController, NotificationsController],
  exports: [NotificationService, DeviceTokenService],
})
export class NotificationsModule {}

