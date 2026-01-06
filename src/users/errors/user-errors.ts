import { AppError } from '../../common/errors/base-errors';

export enum UserErrorCode {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_EMAIL_NOT_VERIFIED = 'USER_EMAIL_NOT_VERIFIED',
  USER_NOT_ACTIVE = 'USER_NOT_ACTIVE',
  USER_NOT_AUTHOR = 'USER_NOT_AUTHOR',
  USER_NOT_READER = 'USER_NOT_READER',
  USER_ACCESS_DENIED = 'USER_ACCESS_DENIED',
  USER_INVALID_CREDENTIALS = 'USER_INVALID_CREDENTIALS',
  USER_ALREADY_VERIFIED = 'USER_ALREADY_VERIFIED',
}

export const UserErrors: Record<UserErrorCode, AppError> = {
  [UserErrorCode.USER_NOT_FOUND]: {
    code: UserErrorCode.USER_NOT_FOUND,
    message: 'User not found',
    statusCode: 404,
  },
  [UserErrorCode.USER_ALREADY_EXISTS]: {
    code: UserErrorCode.USER_ALREADY_EXISTS,
    message: 'User already exists',
    statusCode: 409,
  },
  [UserErrorCode.USER_EMAIL_NOT_VERIFIED]: {
    code: UserErrorCode.USER_EMAIL_NOT_VERIFIED,
    message: 'Email verification required',
    statusCode: 403,
  },
  [UserErrorCode.USER_NOT_ACTIVE]: {
    code: UserErrorCode.USER_NOT_ACTIVE,
    message: 'User account is not active',
    statusCode: 403,
  },
  [UserErrorCode.USER_NOT_AUTHOR]: {
    code: UserErrorCode.USER_NOT_AUTHOR,
    message: 'User is not an author',
    statusCode: 403,
  },
  [UserErrorCode.USER_NOT_READER]: {
    code: UserErrorCode.USER_NOT_READER,
    message: 'User is not a reader',
    statusCode: 403,
  },
  [UserErrorCode.USER_ACCESS_DENIED]: {
    code: UserErrorCode.USER_ACCESS_DENIED,
    message: 'Access denied',
    statusCode: 403,
  },
  [UserErrorCode.USER_INVALID_CREDENTIALS]: {
    code: UserErrorCode.USER_INVALID_CREDENTIALS,
    message: 'Invalid credentials',
    statusCode: 401,
  },
  [UserErrorCode.USER_ALREADY_VERIFIED]: {
    code: UserErrorCode.USER_ALREADY_VERIFIED,
    message: 'User is already verified',
    statusCode: 409,
  },
};
