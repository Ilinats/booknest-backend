import { ForbiddenException } from '@nestjs/common';
import { AuthErrorCode, AuthErrors } from '../errors/auth-errors';
import { UserType } from '../../users/enums';

export function ensureAuthor(userType?: UserType | string): void {
  if (userType !== UserType.AUTHOR && userType !== 'author') {
    const error = AuthErrors[AuthErrorCode.AUTHOR_ACCESS_REQUIRED_ERROR];
    throw new ForbiddenException({ message: error.message, code: error.code });
  }
}
