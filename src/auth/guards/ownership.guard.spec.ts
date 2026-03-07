import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { OwnershipGuard } from './ownership.guard';
import { Book } from '../../books/entity/book.entity';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { Series } from '../../series/entity/series.entity';
import { User } from '../../users/entity/user.entity';
import { OWNERSHIP_KEY } from '../decorators/ownership.decorator';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
  };
}

describe('OwnershipGuard', () => {
  let reflector: Reflector;
  let guard: OwnershipGuard;
  let bookRepo: MockRepo<Book>;
  let applicationRepo: MockRepo<Application>;
  let reviewRepo: MockRepo<Review>;
  let seriesRepo: MockRepo<Series>;
  let userRepo: MockRepo<User>;

  function createContext(
    ownershipMeta?: { resource: string; paramName: string },
    user?: { sub: string },
    params: Record<string, string> = {},
  ): ExecutionContext {
    const req: any = { user, params };
    const ctx: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}) as any,
      getClass: () => ({}) as any,
    } as any;

    (reflector.getAllAndOverride as jest.Mock).mockImplementation(
      (key: string) => {
        if (key === OWNERSHIP_KEY) {
          return ownershipMeta;
        }
        return undefined;
      },
    );

    return ctx;
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    bookRepo = createMockRepo();
    applicationRepo = createMockRepo();
    reviewRepo = createMockRepo();
    seriesRepo = createMockRepo();
    userRepo = createMockRepo();

    guard = new OwnershipGuard(
      reflector,
      bookRepo as any,
      applicationRepo as any,
      reviewRepo as any,
      seriesRepo as any,
      userRepo as any,
    );
  });

  it('returns true when no ownership metadata', async () => {
    const ctx = createContext(undefined, { sub: 'u1' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when user is missing', async () => {
    const ctx = createContext(
      { resource: 'book', paramName: 'id' },
      undefined,
      {
        id: 'b1',
      },
    );

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws NotFoundException when resourceId param missing', async () => {
    const ctx = createContext(
      { resource: 'book', paramName: 'id' },
      { sub: 'u1' },
    );

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('allows owner of book', async () => {
    const ctx = createContext(
      { resource: 'book', paramName: 'id' },
      { sub: 'u1' },
      {
        id: 'b1',
      },
    );
    bookRepo.findOne.mockResolvedValue({
      id: 'b1',
      authorId: 'u1',
    } as any);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
