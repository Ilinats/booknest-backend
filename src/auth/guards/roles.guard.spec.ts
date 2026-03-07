import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserType } from '../../users/enums';

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  function createContext(user?: { userType?: UserType }) {
    const req: any = { user };
    const ctx: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}) as any,
      getClass: () => ({}) as any,
    } as any;
    return ctx;
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    guard = new RolesGuard(reflector);
  });

  it('returns true when no required roles', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const ctx = createContext();

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws when user missing for required roles', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserType.AUTHOR,
    ]);
    const ctx = createContext(undefined);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows when user has required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserType.AUTHOR,
    ]);
    const ctx = createContext({ userType: UserType.AUTHOR });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws specific error when required role is AUTHOR and user has different role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserType.AUTHOR,
    ]);
    const ctx = createContext({ userType: UserType.READER });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws READER_ACCESS_REQUIRED when required role is READER and user has different role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserType.READER,
    ]);
    const ctx = createContext({ userType: UserType.AUTHOR });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws generic role error when required roles are not author or reader', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'admin' as any,
    ]);
    const ctx = createContext({ userType: 'other' as any });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
