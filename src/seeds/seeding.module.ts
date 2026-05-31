import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Genre } from '../genres/entity/genre.entity';
import { User } from '../users/entity';
import { Book, BookGenre } from '../books/entity';
import { Series } from '../series/entity/series.entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { Friend } from '../friends/entity/friend.entity';
import { AuthorFollow } from '../author-follow/entity/author-follow.entity';
import { UserGenrePreference } from '../user-genre-preferences/entity/user-genre-preference.entity';
import { UserProfile } from '../user-profile/entity/user-profile.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { UserActivity } from '../user-activity/entity/user-activity.entity';
import { FilesModule } from '../files/files.module';
import { SeedingService } from './seeding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Genre,
      User,
      Book,
      BookGenre,
      Series,
      Application,
      Review,
      Friend,
      AuthorFollow,
      UserGenrePreference,
      UserProfile,
      UserAddress,
      UserActivity,
    ]),
    FilesModule,
  ],
  providers: [SeedingService],
  exports: [SeedingService],
})
export class SeedingModule {}
