import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../decorators/current-user.decorator';
import { AuthErrorCode, AuthErrors } from '../../common/errors/auth-errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../../books/entity/book.entity';
import { BookErrors, BookErrorCode } from '../../books/errors';
import {
  ApplicationErrors,
  ApplicationErrorCode,
} from '../../applications/errors';
import { ReviewErrorCode } from '../../reviews/errors';
import { SeriesErrors, SeriesErrorCode } from '../../series/errors';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { Series } from '../../series/entity/series.entity';
import { User } from '../../users/entity/user.entity';
import { OWNERSHIP_KEY } from '../decorators/ownership.decorator';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Series) private readonly seriesRepo: Repository<Series>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ownership = this.reflector.getAllAndOverride<{
      resource: string;
      paramName: string;
    }>(OWNERSHIP_KEY, [context.getHandler(), context.getClass()]);

    if (!ownership) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      const error = AuthErrors[AuthErrorCode.UNAUTHORIZED_ERROR];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    const resourceId = request.params[ownership.paramName];
    if (!resourceId) {
      throw new NotFoundException(
        'Resource ID not found in request parameters',
      );
    }

    const userId = user.sub;

    let isOwner = false;

    switch (ownership.resource) {
      case 'book': {
        const book = await this.bookRepo.findOne({ where: { id: resourceId } });
        if (!book) {
          const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
          throw new NotFoundException({
            message: error.message,
            code: error.code,
          });
        }
        isOwner = book.authorId === userId;
        break;
      }

      case 'application': {
        const application = await this.applicationRepo.findOne({
          where: { id: resourceId },
          relations: ['book', 'reader'],
        });
        if (!application) {
          const error =
            ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
          throw new NotFoundException({
            message: error.message,
            code: error.code,
          });
        }
        isOwner =
          application.readerId === userId ||
          application.book.authorId === userId;
        break;
      }

      case 'review': {
        const review = await this.reviewRepo.findOne({
          where: { id: resourceId },
          relations: ['application', 'application.reader', 'application.book'],
        });
        if (!review) {
          throw new NotFoundException(ReviewErrorCode.REVIEW_NOT_FOUND);
        }
        isOwner =
          review.application.readerId === userId ||
          review.application.book.authorId === userId;
        break;
      }

      case 'series': {
        const series = await this.seriesRepo.findOne({
          where: { id: resourceId },
        });
        if (!series) {
          const error = SeriesErrors[SeriesErrorCode.SERIES_NOT_FOUND];
          throw new NotFoundException({
            message: error.message,
            code: error.code,
          });
        }
        isOwner = series.authorId === userId;
        break;
      }

      case 'user':
        isOwner = resourceId === userId;
        break;

      default: {
        const error = AuthErrors[AuthErrorCode.INVALID_OWNERSHIP_RESOURCE_TYPE];
        throw new ForbiddenException({
          message: error.message,
          code: error.code,
        });
      }
    }

    if (!isOwner) {
      const error = AuthErrors[AuthErrorCode.ROLE_ACCESS_REQUIRED_ERROR];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    return true;
  }
}
