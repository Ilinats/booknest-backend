import { ForbiddenException } from '@nestjs/common';
import { Book } from '../entity/book.entity';
import { BookErrors } from '../errors/book-errors';

export function assertBookAuthor(book: Book, authorId: string): void {
  if (book.authorId !== authorId) {
    throw new ForbiddenException(BookErrors.BOOK_NOT_OWNED_BY_AUTHOR);
  }
}
