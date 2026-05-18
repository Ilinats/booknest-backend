import { Application } from '../entity/application.entity';
import { Book } from '../../books/entity';
import { ApplicationStatus, ReadingStatus } from '../enums';

export class ApplicationSanitizationHelper {
  static sanitizeBookForApplication(book: Book | null) {
    if (!book) {
      return null;
    }

    const sanitized = { ...book };
    delete sanitized.fileUrl;
    delete sanitized.fileSize;
    delete sanitized.fileType;
    return sanitized as Book;
  }

  static shouldSanitizeBook(
    application: Application,
    isAuthor: boolean,
  ): boolean {
    const hasReaderBookAccess =
      application.status === ApplicationStatus.APPROVED;
    const isReviewed = application.readingStatus === ReadingStatus.REVIEWED;
    return !isAuthor && !hasReaderBookAccess && !isReviewed;
  }

  static sanitizeApplicationBook(
    application: Application,
    isAuthor: boolean,
  ): Application {
    if (this.shouldSanitizeBook(application, isAuthor) && application.book) {
      application.book = this.sanitizeBookForApplication(
        application.book,
      ) as Book;
    }
    return application;
  }

  static sanitizeApplications(
    applications: Application[],
    isAuthor: boolean,
  ): Application[] {
    return applications.map((app) =>
      this.sanitizeApplicationBook(app, isAuthor),
    );
  }
}
