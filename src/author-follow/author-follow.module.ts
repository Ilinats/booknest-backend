import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorFollow } from './entity/author-follow.entity';
import { User } from '../users/entity';
import { Book } from '../books/entity';
import { Application } from '../applications/entity/application.entity';
import { AuthorFollowService } from './author-follow.service';
import { AuthorFollowController } from './author-follow.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthorFollow, User, Book, Application]),
    AuthModule,
  ],
  providers: [AuthorFollowService],
  controllers: [AuthorFollowController],
  exports: [AuthorFollowService],
})
export class AuthorFollowModule {}
