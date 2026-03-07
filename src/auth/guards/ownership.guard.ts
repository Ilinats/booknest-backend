import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../decorators/current-user.decorator';
import { AuthErrors } from '../errors/auth-errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../../books/entity/book.entity';
import { BookErrors } from '../../books/errors';
import { ApplicationErrors } from '../../applications/errors';
import { ReviewErrorCode } from '../../reviews/errors';
import { SeriesErrors, SeriesErrorCode } from '../../series/errors';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { Series } from '../../series/entity/series.entity';
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
      throw new ForbiddenException(AuthErrors.ROLE_ACCESS_REQUIRED);
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
          throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
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
          throw new NotFoundException(ApplicationErrors.APPLICATION_NOT_FOUND);
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
          throw new NotFoundException(
            SeriesErrors[SeriesErrorCode.SERIES_NOT_FOUND],
          );
        }
        isOwner = series.authorId === userId;
        break;
      }

      case 'user':
        isOwner = resourceId === userId;
        break;

      default:
        throw new ForbiddenException(AuthErrors.ROLE_ACCESS_REQUIRED);
    }

    if (!isOwner) {
      throw new ForbiddenException(AuthErrors.ROLE_ACCESS_REQUIRED);
    }

    return true;
  }
}
