import { AppError } from './base-errors';

export enum AuthErrorCode {
  UNAUTHORIZED_ERROR = 'UNAUTHORIZED',
  ROLE_ACCESS_REQUIRED_ERROR = 'ROLE_ACCESS_REQUIRED',
  AUTHOR_ACCESS_REQUIRED_ERROR = 'AUTHOR_ACCESS_REQUIRED',
  READER_ACCESS_REQUIRED_ERROR = 'READER_ACCESS_REQUIRED',
}

export const AuthErrors: Record<AuthErrorCode, AppError> = {
  [AuthErrorCode.UNAUTHORIZED_ERROR]: {
    code: AuthErrorCode.UNAUTHORIZED_ERROR,
    message: 'Unauthorized access',
    statusCode: 401,
  },
  [AuthErrorCode.ROLE_ACCESS_REQUIRED_ERROR]: {
    code: AuthErrorCode.ROLE_ACCESS_REQUIRED_ERROR,
    message: 'Access denied. Insufficient permissions.',
    statusCode: 403,
  },
  [AuthErrorCode.AUTHOR_ACCESS_REQUIRED_ERROR]: {
    code: AuthErrorCode.AUTHOR_ACCESS_REQUIRED_ERROR,
    message: 'Author access required',
    statusCode: 403,
  },
  [AuthErrorCode.READER_ACCESS_REQUIRED_ERROR]: {
    code: AuthErrorCode.READER_ACCESS_REQUIRED_ERROR,
    message: 'Reader access required',
    statusCode: 403,
  },
};
