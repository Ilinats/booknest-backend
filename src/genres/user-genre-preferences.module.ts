import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserGenrePreferencesController } from './user-genre-preferences.controller';
import { UserGenrePreferencesService } from './user-genre-preferences.service';
import { UserGenrePreference } from './entity/user-genre-preference.entity';
import { Genre } from './entity/genre.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserGenrePreference, Genre]), AuthModule],
  controllers: [UserGenrePreferencesController],
  providers: [UserGenrePreferencesService],
})
export class UserGenrePreferencesModule {}


