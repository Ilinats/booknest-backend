import { User } from '../../users/entity/user.entity';
import { UserType } from '../../users/enums';

export function sanitizeUser(user: User): {
  id: string;
  username?: string | null;
  email?: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  bio?: string | null;
  avatarUrl?: string | null;
  isVerified: boolean;
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt?: Date;
} {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    userType: user.userType,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function sanitizeUserPublic(user: User): {
  id: string;
  username?: string | null;
  firstName: string;
  lastName: string;
  userType: UserType;
  bio?: string | null;
  avatarUrl?: string | null;
  isVerified: boolean;
  createdAt: Date;
} {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    userType: user.userType,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

export function extractUserId(user: User | string): string {
  return typeof user === 'string' ? user : user.id;
}
