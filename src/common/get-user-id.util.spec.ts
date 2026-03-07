import { getUserId } from './get-user-id.util';

describe('getUserId', () => {
  it('returns user.sub when present', () => {
    const req: any = { user: { sub: 'user-1' } };
    expect(getUserId(req)).toBe('user-1');
  });

  it('falls back to user.id when sub is missing', () => {
    const req: any = { user: { id: 'user-2' } };
    expect(getUserId(req)).toBe('user-2');
  });

  it('throws when user id is missing', () => {
    const req: any = { user: {} };
    expect(() => getUserId(req)).toThrowError('User ID not found in JWT token');
  });
});
