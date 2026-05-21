import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './entity/book.entity';
import { BookGenre } from './entity/book-genre.entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { User } from '../users/entity/user.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { UserGenrePreference } from '../user-genre-preferences/entity/user-genre-preference.entity';
import { Genre } from '../genres/entity/genre.entity';
import { Series } from '../series/entity/series.entity';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { BooksAnalyticsService } from './services/books-analytics.service';
import { BooksFileService } from './services/books-file.service';
import { BookPdfFingerprintService } from './services/book-pdf-fingerprint.service';
import { BookEpubFingerprintService } from './services/book-epub-fingerprint.service';
import { BooksSchedulerService } from './services/books-scheduler.service';
import {
  BooksQueryHelper,
  BooksUpdateHelper,
  BooksAnalyticsBookQueriesHelper,
  BooksAnalyticsAuthorQueriesHelper,
} from './helpers';
import { SeriesModule } from '../series/series.module';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { BookAuthorGuard, ApprovedBookApplicationGuard } from './guards';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Book,
      Series,
      BookGenre,
      Application,
      Review,
      User,
      UserAddress,
      UserGenrePreference,
      Genre,
    ]),
    SeriesModule,
    AuthModule,
    FilesModule,
  ],
  providers: [
    BooksService,
    BooksQueryHelper,
    BooksUpdateHelper,
    BooksAnalyticsBookQueriesHelper,
    BooksAnalyticsAuthorQueriesHelper,
    BooksAnalyticsService,
    BooksFileService,
    BookPdfFingerprintService,
    BookEpubFingerprintService,
    BooksSchedulerService,
    BookAuthorGuard,
    ApprovedBookApplicationGuard,
  ],
  controllers: [BooksController],
  exports: [
    BooksService,
    BooksAnalyticsService,
    BooksAnalyticsAuthorQueriesHelper,
    BooksFileService,
  ],
})
export class BooksModule {}
