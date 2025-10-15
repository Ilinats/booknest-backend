import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './entity/book.entity';
import { Series } from './entity/series.entity';
import { BookGenre } from './entity/book-genre.entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../applications/entity/review.entity';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { SeriesService } from './series.service';
import { SeriesController } from './series.controller';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([Book, Series, BookGenre, Application, Review]), AuthModule, FilesModule],
  providers: [BooksService, SeriesService],
  controllers: [BooksController, SeriesController],
  exports: [BooksService],
})
export class BooksModule {}


