import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/app-config.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { GenresModule } from './genres/genres.module';
import { UserGenrePreferencesModule } from './genres/user-genre-preferences.module';

@Module({
  imports: [AppConfigModule, MailModule, AuthModule, UsersModule, GenresModule, UserGenrePreferencesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
