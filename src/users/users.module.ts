import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { BooksModule } from '../books/books.module';
import { UsersReaderStatsHelper } from './helpers/users-reader-stats.helper';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Application, Review]),
    AuthModule,
    FilesModule,
    BooksModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersReaderStatsHelper],
  exports: [UsersService],
})
export class UsersModule {}
