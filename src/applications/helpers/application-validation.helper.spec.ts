import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationValidationHelper } from './application-validation.helper';
import { Application } from '../entity/application.entity';
import { Book } from '../../books/entity';
import { User } from '../../users/entity/user.entity';
import { ApplicationErrors } from '../errors';
import { ApplicationStatus } from '../enums';
import { AgeRating, BookStatus } from '../../books/enums';

describe('ApplicationValidationHelper', () => {
  describe('validateUserForApplication', () => {
    it('throws NotFoundException when user is null', () => {
      expect(() =>
        ApplicationValidationHelper.validateUserForApplication(null),
      ).toThrow(NotFoundException);
    });

    it('throws ForbiddenException when email is not verified', () => {
      const user = { emailVerified: false } as User;
      expect(() =>
        ApplicationValidationHelper.validateUserForApplication(user),
      ).toThrow(ForbiddenException);
    });

    it('does not throw when user exists and email is verified', () => {
      const user = { emailVerified: true } as User;
      expect(() =>
        ApplicationValidationHelper.validateUserForApplication(user),
      ).not.toThrow();
    });
  });

  describe('validateBookForApplication', () => {
    it('throws when book status is not ACTIVE', () => {
      const book = {
        status: BookStatus.IN_PROGRESS,
        availableCopies: 1,
        applicationDeadline: new Date(Date.now() + 86400000),
      } as Book;
      expect(() =>
        ApplicationValidationHelper.validateBookForApplication(book),
      ).toThrow(BadRequestException);
    });

    it('throws when availableCopies <= 0', () => {
      const book = {
        status: BookStatus.ACTIVE,
        availableCopies: 0,
        applicationDeadline: new Date(Date.now() + 86400000),
      } as Book;
      expect(() =>
        ApplicationValidationHelper.validateBookForApplication(book),
      ).toThrow(BadRequestException);
    });

    it('throws when applicationDeadline has passed', () => {
      const book = {
        status: BookStatus.ACTIVE,
        availableCopies: 1,
        applicationDeadline: new Date(Date.now() - 86400000),
      } as Book;
      expect(() =>
        ApplicationValidationHelper.validateBookForApplication(book),
      ).toThrow(BadRequestException);
    });

    it('does not throw when book is valid', () => {
      const book = {
        status: BookStatus.ACTIVE,
        availableCopies: 1,
        applicationDeadline: new Date(Date.now() + 86400000),
      } as Book;
      expect(() =>
        ApplicationValidationHelper.validateBookForApplication(book),
      ).not.toThrow();
    });
  });

  describe('validateApplicationDoesNotExist', () => {
    it('throws ConflictException when existing application is provided', () => {
      const existing = { id: 'app-1' } as Application;
      expect(() =>
        ApplicationValidationHelper.validateApplicationDoesNotExist(existing),
      ).toThrow(ConflictException);
    });

    it('does not throw when existing is null', () => {
      expect(() =>
        ApplicationValidationHelper.validateApplicationDoesNotExist(null),
      ).not.toThrow();
    });
  });

  describe('validateUserAgeForBook', () => {
    it('does not throw when ageRating is ALL', () => {
      const user = { birthDate: new Date('2000-01-01') } as unknown as User;
      const book = { ageRating: AgeRating.ALL } as Book;
      expect(() =>
        ApplicationValidationHelper.validateUserAgeForBook(user, book),
      ).not.toThrow();
    });

    it('does not throw when user has no birthDate', () => {
      const user = { birthDate: undefined } as User;
      const book = { ageRating: AgeRating.THIRTEEN_PLUS } as Book;
      expect(() =>
        ApplicationValidationHelper.validateUserAgeForBook(user, book),
      ).not.toThrow();
    });

    it('throws when user is under 13 for THIRTEEN_PLUS', () => {
      const user = { birthDate: new Date() }; // today = 0 years
      const today = new Date();
      user.birthDate = new Date(today.getFullYear() - 10, 0, 1);
      const book = { ageRating: AgeRating.THIRTEEN_PLUS } as Book;
      expect(() =>
        ApplicationValidationHelper.validateUserAgeForBook(user as unknown as User, book),
      ).toThrow(ForbiddenException);
    });

    it('does not throw when user is 13 or older for THIRTEEN_PLUS', () => {
      const today = new Date();
      const user = {
        birthDate: new Date(today.getFullYear() - 14, today.getMonth(), today.getDate()),
      } as unknown as User;
      const book = { ageRating: AgeRating.THIRTEEN_PLUS } as Book;
      expect(() =>
        ApplicationValidationHelper.validateUserAgeForBook(user, book),
      ).not.toThrow();
    });

    it('throws when user is under 16 for SIXTEEN_PLUS', () => {
      const today = new Date();
      const user = {
        birthDate: new Date(today.getFullYear() - 15, today.getMonth(), today.getDate() + 1),
      } as unknown as User;
      const book = { ageRating: AgeRating.SIXTEEN_PLUS } as Book;
      expect(() =>
        ApplicationValidationHelper.validateUserAgeForBook(user, book),
      ).toThrow(ForbiddenException);
    });

    it('throws when user is under 18 for EIGHTEEN_PLUS', () => {
      const today = new Date();
      const user = {
        birthDate: new Date(today.getFullYear() - 17, today.getMonth(), today.getDate()),
      } as unknown as User;
      const book = { ageRating: AgeRating.EIGHTEEN_PLUS } as Book;
      expect(() =>
        ApplicationValidationHelper.validateUserAgeForBook(user, book),
      ).toThrow(ForbiddenException);
    });

    it('does not throw for unknown age rating (default branch)', () => {
      const user = { birthDate: new Date('2000-01-01') } as unknown as User;
      const book = { ageRating: 'unknown' as AgeRating } as Book;
      expect(() =>
        ApplicationValidationHelper.validateUserAgeForBook(user, book),
      ).not.toThrow();
    });
  });

  describe('validateApplicationStatus', () => {
    it('throws when status does not match expected', () => {
      const app = { status: ApplicationStatus.PENDING } as Application;
      expect(() =>
        ApplicationValidationHelper.validateApplicationStatus(
          app,
          ApplicationStatus.APPROVED,
          ApplicationErrors.APPLICATION_NOT_APPROVED,
        ),
      ).toThrow(ForbiddenException);
    });

    it('does not throw when status matches', () => {
      const app = { status: ApplicationStatus.APPROVED } as Application;
      expect(() =>
        ApplicationValidationHelper.validateApplicationStatus(
          app,
          ApplicationStatus.APPROVED,
          ApplicationErrors.APPLICATION_NOT_APPROVED,
        ),
      ).not.toThrow();
    });
  });

  describe('validateBookOwnership', () => {
    it('throws when book authorId does not match', () => {
      const book = { authorId: 'author-1' } as Book;
      expect(() =>
        ApplicationValidationHelper.validateBookOwnership(book, 'author-2'),
      ).toThrow(ForbiddenException);
    });

    it('does not throw when authorId matches', () => {
      const book = { authorId: 'author-1' } as Book;
      expect(() =>
        ApplicationValidationHelper.validateBookOwnership(book, 'author-1'),
      ).not.toThrow();
    });
  });

  describe('validateApplicationAccess', () => {
    it('throws when userId is neither reader nor book author', () => {
      const app = {
        readerId: 'r1',
        book: { authorId: 'a1' },
      } as Application;
      expect(() =>
        ApplicationValidationHelper.validateApplicationAccess(app, 'other-user'),
      ).toThrow(ForbiddenException);
    });

    it('does not throw when userId is reader', () => {
      const app = {
        readerId: 'r1',
        book: { authorId: 'a1' },
      } as Application;
      expect(() =>
        ApplicationValidationHelper.validateApplicationAccess(app, 'r1'),
      ).not.toThrow();
    });

    it('does not throw when userId is book author', () => {
      const app = {
        readerId: 'r1',
        book: { authorId: 'a1' },
      } as Application;
      expect(() =>
        ApplicationValidationHelper.validateApplicationAccess(app, 'a1'),
      ).not.toThrow();
    });
  });
});
