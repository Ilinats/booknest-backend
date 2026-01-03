import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserGenrePreference } from './entity/user-genre-preference.entity';
import { User } from '../users/entity/user.entity';
import { Genre } from '../genres/entity/genre.entity';
import { UserGenrePreferencesService } from './user-genre-preferences.service';
import { UserGenrePreferencesController } from './user-genre-preferences.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserGenrePreference, User, Genre]),
    AuthModule,
  ],
  providers: [UserGenrePreferencesService],
  controllers: [UserGenrePreferencesController],
  exports: [UserGenrePreferencesService],
})
export class UserGenrePreferencesModule {}
