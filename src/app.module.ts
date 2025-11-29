import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/app-config.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { GenresModule } from './genres/genres.module';
import { UserGenrePreferencesModule } from './genres/user-genre-preferences.module';
import { BooksModule } from './books/books.module';
import { ApplicationsModule } from './applications/applications.module';
import { FilesModule } from './files/files.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SuccessResponseInterceptor } from './common/success-response.interceptor';
import { ErrorResponseFilter } from './common/error-response.filter';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    AppConfigModule, 
    MailModule, 
    AuthModule, 
    UsersModule, 
    GenresModule, 
    UserGenrePreferencesModule, 
    BooksModule, 
    ApplicationsModule,
    FilesModule,
    NotificationsModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SuccessResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ErrorResponseFilter,
    },
  ],
})
export class AppModule {}
