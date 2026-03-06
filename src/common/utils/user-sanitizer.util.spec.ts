import {
  sanitizeUser,
  sanitizeUserPublic,
  extractUserId,
} from './user-sanitizer.util';
import { User } from '../../users/entity/user.entity';
import { UserType } from '../../users/enums';

describe('user-sanitizer.util', () => {
  const baseUser: User = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    userType: UserType.READER,
    bio: 'bio',
    avatarUrl: 'avatar',
    isVerified: true,
    emailVerified: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  } as any;

  it('sanitizeUser maps all expected fields', () => {
    const result = sanitizeUser(baseUser);

    expect(result).toEqual({
      id: 'user-1',
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      userType: UserType.READER,
      bio: 'bio',
      avatarUrl: 'avatar',
      isVerified: true,
      emailVerified: true,
      createdAt: baseUser.createdAt,
      updatedAt: baseUser.updatedAt,
    });
  });

  it('sanitizeUserPublic hides email and verification flags', () => {
    const result = sanitizeUserPublic(baseUser);

    expect(result).toEqual({
      id: 'user-1',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      userType: UserType.READER,
      bio: 'bio',
      avatarUrl: 'avatar',
      isVerified: true,
      createdAt: baseUser.createdAt,
    });
    expect((result as any).email).toBeUndefined();
    expect((result as any).emailVerified).toBeUndefined();
  });

  it('extractUserId returns id from user object', () => {
    expect(extractUserId(baseUser)).toBe('user-1');
  });

  it('extractUserId returns string when already an id', () => {
    expect(extractUserId('user-2' as any)).toBe('user-2');
  });
});
