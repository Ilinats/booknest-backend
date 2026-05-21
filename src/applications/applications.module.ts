import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './entity/application.entity';
import { Book } from '../books/entity';
import { User } from '../users/entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { Review } from '../reviews/entity/review.entity';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { ReviewsModule } from '../reviews/reviews.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notifications/notification.module';
import { UserActivityModule } from '../user-activity/user-activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ Application, Book, User, UserAddress, Review]),
    ReviewsModule,
    AuthModule,
    forwardRef(() => NotificationModule),
    forwardRef(() => UserActivityModule),
  ],
  providers: [ApplicationsService],
  controllers: [ApplicationsController],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
