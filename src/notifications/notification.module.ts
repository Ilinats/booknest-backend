import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entity/notification.entity';
import { DeviceToken } from './entity/device-token.entity';
import { NotificationService } from './notification.service';
import { DeviceTokenService } from './device-token.service';
import { NotificationsController } from './notification.controller';
import { DeviceTokenController } from './device-token.controller';
import { FirebaseNotificationService } from './firebase-notification.service';
import { UserProfileModule } from '../user-profile/user-profile.module';
import { Book } from '../books/entity';
import { Application } from '../applications/entity';
import { User } from '../users/entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      DeviceToken,
      Book,
      Application,
      User,
    ]),
    forwardRef(() => UserProfileModule),
    AuthModule,
  ],
  controllers: [NotificationsController, DeviceTokenController],
  providers: [
    NotificationService,
    DeviceTokenService,
    FirebaseNotificationService,
    {
      provide: 'NotificationService',
      useExisting: NotificationService,
    },
  ],
  exports: [
    NotificationService,
    DeviceTokenService,
    {
      provide: 'NotificationService',
      useExisting: NotificationService,
    },
  ],
})
export class NotificationModule {}
