import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProfile } from './entity/user-profile.entity';
import { User } from '../users/entity/user.entity';
import { UserProfileService } from './user-profile.service';
import { UserProfileController } from './user-profile.controller';
import { FriendsModule } from '../friends/friends.module';
import { UserActivityModule } from '../user-activity/user-activity.module';
import { UserAddressModule } from '../user-address/user-address.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProfile, User]),
    forwardRef(() => FriendsModule),
    forwardRef(() => UserActivityModule),
    forwardRef(() => UsersModule),
    AuthModule,
    UserAddressModule,
  ],
  providers: [UserProfileService],
  controllers: [UserProfileController],
  exports: [UserProfileService],
})
export class UserProfileModule {}
