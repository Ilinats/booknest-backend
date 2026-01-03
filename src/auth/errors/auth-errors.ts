import { AppError } from '../../common/errors/base-errors';

export enum AuthErrorCode {
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  REFRESH_TOKEN_REUSE = 'REFRESH_TOKEN_REUSE',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  INVALID_VERIFICATION_CODE = 'INVALID_VERIFICATION_CODE',
  VERIFICATION_CODE_EXPIRED = 'VERIFICATION_CODE_EXPIRED',
  PASSWORD_RESET_TOKEN_INVALID = 'PASSWORD_RESET_TOKEN_INVALID',
  PASSWORD_RESET_TOKEN_EXPIRED = 'PASSWORD_RESET_TOKEN_EXPIRED',
  GOOGLE_AUTH_FAILED = 'GOOGLE_AUTH_FAILED',
}

export const AuthErrors: Record<AuthErrorCode, AppError> = {
  [AuthErrorCode.USER_ALREADY_EXISTS]: {
    code: AuthErrorCode.USER_ALREADY_EXISTS,
    message: 'User already exists',
    statusCode: 409,
  },
  [AuthErrorCode.INVALID_CREDENTIALS]: {
    code: AuthErrorCode.INVALID_CREDENTIALS,
    message: 'Invalid credentials',
    statusCode: 401,
  },
  [AuthErrorCode.INVALID_REFRESH_TOKEN]: {
    code: AuthErrorCode.INVALID_REFRESH_TOKEN,
    message: 'Invalid refresh token',
    statusCode: 401,
  },
  [AuthErrorCode.REFRESH_TOKEN_REUSE]: {
    code: AuthErrorCode.REFRESH_TOKEN_REUSE,
    message: 'Refresh token reuse detected',
    statusCode: 401,
  },
  [AuthErrorCode.USER_NOT_FOUND]: {
    code: AuthErrorCode.USER_NOT_FOUND,
    message: 'User not found',
    statusCode: 404,
  },
  [AuthErrorCode.EMAIL_NOT_VERIFIED]: {
    code: AuthErrorCode.EMAIL_NOT_VERIFIED,
    message: 'Email not verified',
    statusCode: 403,
  },
  [AuthErrorCode.INVALID_VERIFICATION_CODE]: {
    code: AuthErrorCode.INVALID_VERIFICATION_CODE,
    message: 'Invalid verification code',
    statusCode: 400,
  },
  [AuthErrorCode.VERIFICATION_CODE_EXPIRED]: {
    code: AuthErrorCode.VERIFICATION_CODE_EXPIRED,
    message: 'Verification code expired',
    statusCode: 400,
  },
  [AuthErrorCode.PASSWORD_RESET_TOKEN_INVALID]: {
    code: AuthErrorCode.PASSWORD_RESET_TOKEN_INVALID,
    message: 'Invalid password reset token',
    statusCode: 400,
  },
  [AuthErrorCode.PASSWORD_RESET_TOKEN_EXPIRED]: {
    code: AuthErrorCode.PASSWORD_RESET_TOKEN_EXPIRED,
    message: 'Password reset token expired',
    statusCode: 400,
  },
  [AuthErrorCode.GOOGLE_AUTH_FAILED]: {
    code: AuthErrorCode.GOOGLE_AUTH_FAILED,
    message: 'Google authentication failed',
    statusCode: 401,
  },
};
