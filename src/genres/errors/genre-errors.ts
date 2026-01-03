import { AppError } from '../../common/errors/base-errors';

export enum GenreErrorCode {
  GENRE_NOT_FOUND = 'GENRE_NOT_FOUND',
  GENRE_ALREADY_EXISTS = 'GENRE_ALREADY_EXISTS',
}

export const GenreErrors: Record<GenreErrorCode, AppError> = {
  [GenreErrorCode.GENRE_NOT_FOUND]: {
    code: GenreErrorCode.GENRE_NOT_FOUND,
    message: 'Genre not found',
    statusCode: 404,
  },
  [GenreErrorCode.GENRE_ALREADY_EXISTS]: {
    code: GenreErrorCode.GENRE_ALREADY_EXISTS,
    message: 'Genre already exists',
    statusCode: 409,
  },
};
