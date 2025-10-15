import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FriendsController } from './friends.controller';
import { UserProfilesController } from './user-profiles.controller';
import { AuthorFollowsController } from './author-follows.controller';
import { User } from './entity/user.entity';
import { Friend } from './entity/friend.entity';
import { UserProfile } from './entity/user-profile.entity';
import { AuthorFollow } from './entity/author-follow.entity';
import { UserActivity } from './entity/user-activity.entity';
import { Book } from '../books/entity/book.entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../applications/entity/review.entity';
import { FriendsService } from './friends.service';
import { UserProfileService } from './user-profile.service';
import { AuthorFollowService } from './author-follow.service';
import { UserActivityService } from './user-activity.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, 
      Friend, 
      UserProfile, 
      AuthorFollow, 
      UserActivity,
      Book, 
      Application, 
      Review
    ]), 
    AuthModule
  ],
  controllers: [
    UsersController, 
    FriendsController, 
    UserProfilesController, 
    AuthorFollowsController
  ],
  providers: [
    UsersService, 
    FriendsService, 
    UserProfileService, 
    AuthorFollowService, 
    UserActivityService
  ],
  exports: [
    UsersService, 
    FriendsService, 
    UserProfileService, 
    AuthorFollowService, 
    UserActivityService
  ],
})
export class UsersModule {} 