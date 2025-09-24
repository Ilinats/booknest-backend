import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenresService } from './genres.service';
import { GenresController } from './genres.controller';
import { Genre } from './entity/genre.entity';
import { UserGenrePreference } from './entity/user-genre-preference.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Genre, UserGenrePreference])],
  controllers: [GenresController],
  providers: [GenresService],
  exports: [GenresService],
})
export class GenresModule {}


