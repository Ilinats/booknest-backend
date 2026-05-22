import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Friend } from './entity/friend.entity';
import { User } from '../users/entity/user.entity';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import {
  FriendsListHelper,
  FriendsNotificationsHelper,
  FriendsQueryHelper,
  FriendsSearchHelper,
} from './helpers';
import { UserActivityModule } from '../user-activity/user-activity.module';
import { NotificationModule } from '../notifications/notification.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Friend, User]),
    forwardRef(() => UserActivityModule),
    forwardRef(() => NotificationModule),
    AuthModule,
  ],
  providers: [
    FriendsService,
    FriendsQueryHelper,
    FriendsListHelper,
    FriendsSearchHelper,
    FriendsNotificationsHelper,
  ],
  controllers: [FriendsController],
  exports: [FriendsService],
})
export class FriendsModule {}
