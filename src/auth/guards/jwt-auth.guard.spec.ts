import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthGuardErrorCode } from '../errors';

describe('JwtAuthGuard', () => {
  let jwtService: jest.Mocked<JwtService>;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as any;
    guard = new JwtAuthGuard(jwtService);
  });

  function createContext(authHeader?: string): ExecutionContext {
    const req: any = { headers: { authorization: authHeader } };
    const res: any = {};
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as any;
  }

  it('throws when token is missing', async () => {
    const ctx = createContext(undefined);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      AuthGuardErrorCode.MISSING_TOKEN,
    );
  });

  it('throws when token is invalid', async () => {
    const ctx = createContext('Bearer invalid');
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches user and returns true when token is valid', async () => {
    const payload = { sub: 'u1' };
    jwtService.verifyAsync.mockResolvedValue(payload as any);
    const ctx = createContext('Bearer token');

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });
});
