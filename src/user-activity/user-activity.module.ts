import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserActivity } from './entity/user-activity.entity';
import { User } from '../users/entity';
import { Book } from '../books/entity';
import { Application } from '../applications/entity/application.entity';
import { UserActivityService } from './user-activity.service';
import { UserProfileModule } from '../user-profile/user-profile.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserActivity, User, Book, Application]),
    forwardRef(() => UserProfileModule),
  ],
  providers: [UserActivityService],
  controllers: [],
  exports: [UserActivityService],
})
export class UserActivityModule {}
