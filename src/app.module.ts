import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/app-config.module';
import { UsersModule } from './users/users.module';
import { FriendsModule } from './friends/friends.module';
import { AuthorFollowModule } from './author-follow/author-follow.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { UserAddressModule } from './user-address/user-address.module';
import { UserActivityModule } from './user-activity/user-activity.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { GenresModule } from './genres/genres.module';
import { UserGenrePreferencesModule } from './user-genre-preferences/user-genre-preferences.module';
import { BooksModule } from './books/books.module';
import { SeriesModule } from './series/series.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ApplicationsModule } from './applications/applications.module';
import { FilesModule } from './files/files.module';
import { NotificationModule } from './notifications/notification.module';
import { ReportsModule } from './reports/reports.module';
import { SeedingModule } from './seeds/seeding.module';
import { ErrorResponseFilter } from './common/error-response.filter';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AppConfigModule,
    MailModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    AuthorFollowModule,
    UserProfileModule,
    UserAddressModule,
    UserActivityModule,
    GenresModule,
    UserGenrePreferencesModule,
    BooksModule,
    SeriesModule,
    ApplicationsModule,
    ReviewsModule,
    FilesModule,
    NotificationModule,
    ReportsModule,
    SeedingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: ErrorResponseFilter,
    },
  ],
})
export class AppModule {}
