import { AppError } from '../../common/errors/base-errors';

export enum ApplicationErrorCode {
  APPLICATION_NOT_FOUND = 'APPLICATION_NOT_FOUND',
  APPLICATION_ALREADY_EXISTS = 'APPLICATION_ALREADY_EXISTS',
  APPLICATION_NOT_PENDING = 'APPLICATION_NOT_PENDING',
  APPLICATION_NOT_APPROVED = 'APPLICATION_NOT_APPROVED',
  APPLICATION_CANNOT_UPDATE = 'APPLICATION_CANNOT_UPDATE',
  APPLICATION_CANNOT_WITHDRAW = 'APPLICATION_CANNOT_WITHDRAW',
  APPLICATION_ACCESS_DENIED = 'APPLICATION_ACCESS_DENIED',
  APPLICATION_NOT_OWNED_BY_READER = 'APPLICATION_NOT_OWNED_BY_READER',
  APPLICATION_NOT_FOR_AUTHOR_BOOK = 'APPLICATION_NOT_FOR_AUTHOR_BOOK',
  APPLICATION_ADDRESS_REQUIRED = 'APPLICATION_ADDRESS_REQUIRED',
  APPLICATION_EMAIL_VERIFICATION_REQUIRED = 'APPLICATION_EMAIL_VERIFICATION_REQUIRED',
  APPLICATION_BOOK_NOT_ACTIVE = 'APPLICATION_BOOK_NOT_ACTIVE',
  APPLICATION_NO_AVAILABLE_COPIES = 'APPLICATION_NO_AVAILABLE_COPIES',
  APPLICATION_DEADLINE_PASSED = 'APPLICATION_DEADLINE_PASSED',
  APPLICATION_AGE_RESTRICTION_VIOLATION = 'APPLICATION_AGE_RESTRICTION_VIOLATION',
  APPLICATION_READER_ID_REQUIRED = 'APPLICATION_READER_ID_REQUIRED',
  APPLICATION_CANNOT_MANAGE_LOTTERY = 'APPLICATION_CANNOT_MANAGE_LOTTERY',
}

export const ApplicationErrors: Record<ApplicationErrorCode, AppError> = {
  [ApplicationErrorCode.APPLICATION_NOT_FOUND]: {
    code: ApplicationErrorCode.APPLICATION_NOT_FOUND,
    message: 'Application not found',
    statusCode: 404,
  },
  [ApplicationErrorCode.APPLICATION_ALREADY_EXISTS]: {
    code: ApplicationErrorCode.APPLICATION_ALREADY_EXISTS,
    message: 'You have already applied for this book',
    statusCode: 409,
  },
  [ApplicationErrorCode.APPLICATION_NOT_PENDING]: {
    code: ApplicationErrorCode.APPLICATION_NOT_PENDING,
    message: 'Application is not pending',
    statusCode: 403,
  },
  [ApplicationErrorCode.APPLICATION_NOT_APPROVED]: {
    code: ApplicationErrorCode.APPLICATION_NOT_APPROVED,
    message: 'Application is not approved',
    statusCode: 403,
  },
  [ApplicationErrorCode.APPLICATION_CANNOT_UPDATE]: {
    code: ApplicationErrorCode.APPLICATION_CANNOT_UPDATE,
    message: 'Cannot update non-pending applications',
    statusCode: 403,
  },
  [ApplicationErrorCode.APPLICATION_CANNOT_WITHDRAW]: {
    code: ApplicationErrorCode.APPLICATION_CANNOT_WITHDRAW,
    message: 'Cannot withdraw non-pending applications',
    statusCode: 403,
  },
  [ApplicationErrorCode.APPLICATION_ACCESS_DENIED]: {
    code: ApplicationErrorCode.APPLICATION_ACCESS_DENIED,
    message: 'Access denied',
    statusCode: 403,
  },
  [ApplicationErrorCode.APPLICATION_NOT_OWNED_BY_READER]: {
    code: ApplicationErrorCode.APPLICATION_NOT_OWNED_BY_READER,
    message: 'Application not owned by reader',
    statusCode: 403,
  },
  [ApplicationErrorCode.APPLICATION_NOT_FOR_AUTHOR_BOOK]: {
    code: ApplicationErrorCode.APPLICATION_NOT_FOR_AUTHOR_BOOK,
    message: "Cannot manage applications for other authors' books",
    statusCode: 403,
  },
  [ApplicationErrorCode.APPLICATION_ADDRESS_REQUIRED]: {
    code: ApplicationErrorCode.APPLICATION_ADDRESS_REQUIRED,
    message:
      'A shipping address is required to apply for physical copies. Please add your address in your profile settings before applying.',
    statusCode: 400,
  },
  [ApplicationErrorCode.APPLICATION_EMAIL_VERIFICATION_REQUIRED]: {
    code: ApplicationErrorCode.APPLICATION_EMAIL_VERIFICATION_REQUIRED,
    message:
      'Email verification required to apply for books. Please verify your email address first.',
    statusCode: 403,
  },
  [ApplicationErrorCode.APPLICATION_BOOK_NOT_ACTIVE]: {
    code: ApplicationErrorCode.APPLICATION_BOOK_NOT_ACTIVE,
    message: 'Cannot apply for a book that is not active',
    statusCode: 400,
  },
  [ApplicationErrorCode.APPLICATION_NO_AVAILABLE_COPIES]: {
    code: ApplicationErrorCode.APPLICATION_NO_AVAILABLE_COPIES,
    message: 'No available copies for this book',
    statusCode: 400,
  },
  [ApplicationErrorCode.APPLICATION_DEADLINE_PASSED]: {
    code: ApplicationErrorCode.APPLICATION_DEADLINE_PASSED,
    message: 'Application deadline has passed',
    statusCode: 400,
  },
  [ApplicationErrorCode.APPLICATION_AGE_RESTRICTION_VIOLATION]: {
    code: ApplicationErrorCode.APPLICATION_AGE_RESTRICTION_VIOLATION,
    message: 'You do not meet the age requirement to apply for this book',
    statusCode: 400,
  },
  [ApplicationErrorCode.APPLICATION_READER_ID_REQUIRED]: {
    code: ApplicationErrorCode.APPLICATION_READER_ID_REQUIRED,
    message: 'Reader ID is required',
    statusCode: 400,
  },
  [ApplicationErrorCode.APPLICATION_CANNOT_MANAGE_LOTTERY]: {
    code: ApplicationErrorCode.APPLICATION_CANNOT_MANAGE_LOTTERY,
    message:
      'Cannot manually approve or reject applications for books with lottery selection. Please use the run-lottery endpoint after the application deadline.',
    statusCode: 400,
  },
};
