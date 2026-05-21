import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookAuthorGuard } from './book-author.guard';
import { Book } from '../entity/book.entity';
import { BookErrors } from '../errors/book-errors';

type MockRepo = { findOne: jest.Mock };

function createContext(
  user: { sub: string } | undefined,
  params: Record<string, string>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params }),
    }),
  } as ExecutionContext;
}

describe('BookAuthorGuard', () => {
  let guard: BookAuthorGuard;
  let bookRepo: MockRepo;

  beforeEach(() => {
    bookRepo = { findOne: jest.fn() };
    guard = new BookAuthorGuard(bookRepo as any);
  });

  it('allows the book author', async () => {
    bookRepo.findOne.mockResolvedValue({
      id: 'book-1',
      authorId: 'author-1',
    } as Book);

    await expect(
      guard.canActivate(createContext({ sub: 'author-1' }, { bookId: 'book-1' })),
    ).resolves.toBe(true);
  });

  it('throws when book is missing', async () => {
    bookRepo.findOne.mockResolvedValue(null);

    await expect(
      guard.canActivate(createContext({ sub: 'author-1' }, { bookId: 'book-1' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when user is not the author', async () => {
    bookRepo.findOne.mockResolvedValue({
      id: 'book-1',
      authorId: 'other',
    } as Book);

    await expect(
      guard.canActivate(createContext({ sub: 'author-1' }, { bookId: 'book-1' })),
    ).rejects.toMatchObject({
      response: { message: BookErrors.BOOK_NOT_OWNED_BY_AUTHOR },
    });
  });

  it('throws when user is missing', async () => {
    await expect(
      guard.canActivate(createContext(undefined, { bookId: 'book-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
