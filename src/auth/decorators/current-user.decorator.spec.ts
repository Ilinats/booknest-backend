import {
  CurrentUser,
  getCurrentUserFromContext,
  JwtPayload,
} from './current-user.decorator';
import { ExecutionContext } from '@nestjs/common';

describe('CurrentUser decorator', () => {
  it('is defined and is a function', () => {
    expect(CurrentUser).toBeDefined();
    expect(typeof CurrentUser).toBe('function');
  });

  it('getCurrentUserFromContext returns full user when data is undefined', () => {
    const user: JwtPayload = {
      sub: 'user-1',
      username: 'john',
      email: 'john@example.com',
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
    expect(getCurrentUserFromContext(undefined, ctx)).toEqual(user);
  });

  it('getCurrentUserFromContext returns requested property when data is provided', () => {
    const user: JwtPayload = {
      sub: 'user-1',
      username: 'john',
      email: 'john@example.com',
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
    expect(getCurrentUserFromContext('email', ctx)).toBe('john@example.com');
    expect(getCurrentUserFromContext('sub', ctx)).toBe('user-1');
  });

  it('getCurrentUserFromContext returns undefined when user is missing', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;
    expect(getCurrentUserFromContext(undefined, ctx)).toBeUndefined();
    expect(getCurrentUserFromContext('email', ctx)).toBeUndefined();
  });
});
