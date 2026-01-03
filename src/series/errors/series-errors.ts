import { AppError } from '../../common/errors/base-errors';

export enum SeriesErrorCode {
  SERIES_NOT_FOUND = 'SERIES_NOT_FOUND',
  SERIES_NOT_OWNED_BY_AUTHOR = 'SERIES_NOT_OWNED_BY_AUTHOR',
  SERIES_CANNOT_EDIT_OTHERS = 'SERIES_CANNOT_EDIT_OTHERS',
  SERIES_CANNOT_DELETE_OTHERS = 'SERIES_CANNOT_DELETE_OTHERS',
  AUTHOR_ACCESS_REQUIRED = 'AUTHOR_ACCESS_REQUIRED',
}

export const SeriesErrors: Record<SeriesErrorCode, AppError> = {
  [SeriesErrorCode.SERIES_NOT_FOUND]: {
    code: SeriesErrorCode.SERIES_NOT_FOUND,
    message: 'Series not found',
    statusCode: 404,
  },
  [SeriesErrorCode.SERIES_NOT_OWNED_BY_AUTHOR]: {
    code: SeriesErrorCode.SERIES_NOT_OWNED_BY_AUTHOR,
    message: 'Series not found or not owned by author',
    statusCode: 403,
  },
  [SeriesErrorCode.SERIES_CANNOT_EDIT_OTHERS]: {
    code: SeriesErrorCode.SERIES_CANNOT_EDIT_OTHERS,
    message: 'Cannot edit others series',
    statusCode: 403,
  },
  [SeriesErrorCode.SERIES_CANNOT_DELETE_OTHERS]: {
    code: SeriesErrorCode.SERIES_CANNOT_DELETE_OTHERS,
    message: 'Cannot delete others series',
    statusCode: 403,
  },
  [SeriesErrorCode.AUTHOR_ACCESS_REQUIRED]: {
    code: SeriesErrorCode.AUTHOR_ACCESS_REQUIRED,
    message: 'Author access required',
    statusCode: 403,
  },
};
