import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './entity/application.entity';
import { Review } from './entity/review.entity';
import { Book } from '../books/entity/book.entity';
import { User } from '../users/entity/user.entity';
import { ApplicationsService } from './applications.service';
import { ReviewsService } from './reviews.service';
import { ApplicationsController } from './applications.controller';
import { ReviewsController } from './reviews.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Review, Book, User]),
    AuthModule
  ],
  providers: [ApplicationsService, ReviewsService],
  controllers: [ApplicationsController, ReviewsController],
  exports: [ApplicationsService, ReviewsService],
})
export class ApplicationsModule {}
