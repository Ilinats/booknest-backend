import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../entity/book.entity';
import { BookErrors } from '../errors/book-errors';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';
import { AuthErrors } from '../../auth/errors/auth-errors';
import { assertBookAuthor } from '../helpers/book-access.helper';

/** Ensures the authenticated user is the author of `params.bookId`. */
@Injectable()
export class BookAuthorGuard implements CanActivate {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const bookId = request.params.bookId as string | undefined;

    if (!user) {
      throw new ForbiddenException(AuthErrors.ROLE_ACCESS_REQUIRED);
    }

    if (!bookId) {
      throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
    }

    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
    }

    assertBookAuthor(book, user.sub);
    return true;
  }
}
