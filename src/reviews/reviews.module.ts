import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entity/review.entity';
import { Application } from '../applications/entity/application.entity';
import { Book } from '../books/entity/book.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { AuthModule } from '../auth/auth.module';
import { UserActivityModule } from '../user-activity/user-activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Application, Book]),
    AuthModule,
    forwardRef(() => UserActivityModule),
  ],
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
