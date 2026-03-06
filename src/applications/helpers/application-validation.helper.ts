import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Book } from '../../books/entity';
import { User } from '../../users/entity/user.entity';
import { Application } from '../entity/application.entity';
import { ApplicationErrors } from '../errors';
import { BookErrors } from '../../books/errors/book-errors';
import { UserErrorCode, UserErrors } from '../../users/errors/user-errors';
import { ApplicationStatus } from '../enums';
import { AgeRating, BookStatus } from '../../books/enums';

export class ApplicationValidationHelper {
  static validateUserForApplication(user: User | null): void {
    if (!user) {
      const error = UserErrors[UserErrorCode.USER_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        ApplicationErrors.APPLICATION_EMAIL_VERIFICATION_REQUIRED,
      );
    }
  }

  static validateBookForApplication(book: Book): void {
    if (book.status !== BookStatus.ACTIVE) {
      throw new BadRequestException(
        ApplicationErrors.APPLICATION_BOOK_NOT_ACTIVE,
      );
    }

    if (book.availableCopies <= 0) {
      throw new BadRequestException(
        ApplicationErrors.APPLICATION_NO_AVAILABLE_COPIES,
      );
    }

    const now = new Date();
    if (book.applicationDeadline < now) {
      throw new BadRequestException(
        ApplicationErrors.APPLICATION_DEADLINE_PASSED,
      );
    }
  }

  static validateApplicationDoesNotExist(existing: Application | null): void {
    if (existing) {
      throw new ConflictException(ApplicationErrors.APPLICATION_ALREADY_EXISTS);
    }
  }

  static validateUserAgeForBook(user: User, book: Book): void {
    if (book.ageRating === AgeRating.ALL) {
      return;
    }

    if (!user.birthDate) {
      return;
    }

    const birthDate = new Date(user.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    let requiredAge = 0;
    switch (book.ageRating) {
      case AgeRating.THIRTEEN_PLUS:
        requiredAge = 13;
        break;
      case AgeRating.SIXTEEN_PLUS:
        requiredAge = 16;
        break;
      case AgeRating.EIGHTEEN_PLUS:
        requiredAge = 18;
        break;
      default:
        return;
    }

    if (age < requiredAge) {
      throw new ForbiddenException(
        ApplicationErrors.APPLICATION_AGE_RESTRICTION_VIOLATION,
      );
    }
  }

  static validateApplicationStatus(
    application: Application,
    expectedStatus: ApplicationStatus,
    errorCode: ApplicationErrors,
  ): void {
    if (application.status !== expectedStatus) {
      throw new ForbiddenException(errorCode);
    }
  }

  static validateBookOwnership(book: Book, authorId: string): void {
    if (book.authorId !== authorId) {
      throw new ForbiddenException(BookErrors.BOOK_NOT_OWNED_BY_AUTHOR);
    }
  }

  static validateApplicationAccess(
    application: Application,
    userId: string,
  ): void {
    if (
      application.readerId !== userId &&
      application.book.authorId !== userId
    ) {
      throw new ForbiddenException(ApplicationErrors.APPLICATION_ACCESS_DENIED);
    }
  }
}
