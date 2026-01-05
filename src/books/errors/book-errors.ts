import { AppError } from '../../common/errors/base-errors';

export enum BookErrorCode {
  BOOK_NOT_FOUND = 'BOOK_NOT_FOUND',
  BOOK_ALREADY_EXISTS = 'BOOK_ALREADY_EXISTS',
  BOOK_NOT_OWNED_BY_AUTHOR = 'BOOK_NOT_OWNED_BY_AUTHOR',
  BOOK_NOT_ACTIVE = 'BOOK_NOT_ACTIVE',
  BOOK_NO_COPIES_AVAILABLE = 'BOOK_NO_COPIES_AVAILABLE',
  BOOK_INVALID_COPIES = 'BOOK_INVALID_COPIES',
  BOOK_INVALID_DEADLINE = 'BOOK_INVALID_DEADLINE',
  BOOK_CANNOT_MODIFY_OTHERS = 'BOOK_CANNOT_MODIFY_OTHERS',
  BOOK_CANNOT_DELETE_OTHERS = 'BOOK_CANNOT_DELETE_OTHERS',
  BOOK_CANNOT_PUBLISH = 'BOOK_CANNOT_PUBLISH',
  BOOK_ALREADY_PUBLISHED = 'BOOK_ALREADY_PUBLISHED',
  BOOK_FILE_NOT_AVAILABLE = 'BOOK_FILE_NOT_AVAILABLE',
  AUTHOR_ACCESS_REQUIRED = 'AUTHOR_ACCESS_REQUIRED',
  BOOK_INVALID_GENRE_IDS = 'BOOK_INVALID_GENRE_IDS',
}

export const BookErrors: Record<BookErrorCode, AppError> = {
  [BookErrorCode.BOOK_NOT_FOUND]: {
    code: BookErrorCode.BOOK_NOT_FOUND,
    message: 'Book not found',
    statusCode: 404,
  },
  [BookErrorCode.BOOK_ALREADY_EXISTS]: {
    code: BookErrorCode.BOOK_ALREADY_EXISTS,
    message: 'Book already exists',
    statusCode: 409,
  },
  [BookErrorCode.BOOK_NOT_OWNED_BY_AUTHOR]: {
    code: BookErrorCode.BOOK_NOT_OWNED_BY_AUTHOR,
    message: 'Book not owned by author',
    statusCode: 403,
  },
  [BookErrorCode.BOOK_NOT_ACTIVE]: {
    code: BookErrorCode.BOOK_NOT_ACTIVE,
    message: 'Book is not active',
    statusCode: 403,
  },
  [BookErrorCode.BOOK_NO_COPIES_AVAILABLE]: {
    code: BookErrorCode.BOOK_NO_COPIES_AVAILABLE,
    message: 'No copies available for this book',
    statusCode: 403,
  },
  [BookErrorCode.BOOK_INVALID_COPIES]: {
    code: BookErrorCode.BOOK_INVALID_COPIES,
    message: 'Available copies must be between 0 and total copies',
    statusCode: 400,
  },
  [BookErrorCode.BOOK_INVALID_DEADLINE]: {
    code: BookErrorCode.BOOK_INVALID_DEADLINE,
    message: 'Review deadline must be after application deadline',
    statusCode: 400,
  },
  [BookErrorCode.BOOK_CANNOT_MODIFY_OTHERS]: {
    code: BookErrorCode.BOOK_CANNOT_MODIFY_OTHERS,
    message: "Cannot modify other authors' books",
    statusCode: 403,
  },
  [BookErrorCode.BOOK_CANNOT_DELETE_OTHERS]: {
    code: BookErrorCode.BOOK_CANNOT_DELETE_OTHERS,
    message: "Cannot delete other authors' books",
    statusCode: 403,
  },
  [BookErrorCode.BOOK_CANNOT_PUBLISH]: {
    code: BookErrorCode.BOOK_CANNOT_PUBLISH,
    message: 'Cannot publish book',
    statusCode: 403,
  },
  [BookErrorCode.BOOK_ALREADY_PUBLISHED]: {
    code: BookErrorCode.BOOK_ALREADY_PUBLISHED,
    message: 'Book is already published',
    statusCode: 409,
  },
  [BookErrorCode.BOOK_FILE_NOT_AVAILABLE]: {
    code: BookErrorCode.BOOK_FILE_NOT_AVAILABLE,
    message: 'No file available for this book',
    statusCode: 400,
  },
  [BookErrorCode.AUTHOR_ACCESS_REQUIRED]: {
    code: BookErrorCode.AUTHOR_ACCESS_REQUIRED,
    message: 'Author access required',
    statusCode: 403,
  },
  [BookErrorCode.BOOK_INVALID_GENRE_IDS]: {
    code: BookErrorCode.BOOK_INVALID_GENRE_IDS,
    message: 'Invalid genre IDs provided',
    statusCode: 400,
  },
};
