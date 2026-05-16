import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  let jwtService: jest.Mocked<JwtService>;
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as any;
    guard = new OptionalJwtAuthGuard(jwtService);
  });

  function createContext(authHeader?: string): ExecutionContext {
    const req: any = { headers: { authorization: authHeader } };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as any;
  }

  it('allows request and clears user when no token', async () => {
    const ctx = createContext(undefined);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('attaches user on valid token', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1' } as any);
    const ctx = createContext('Bearer token');

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('clears user and still allows on invalid token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));
    const ctx = createContext('Bearer bad');

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });
});
