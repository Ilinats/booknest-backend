import { ApplicationSanitizationHelper } from './application-sanitization.helper';
import { Application } from '../entity/application.entity';
import { Book } from '../../books/entity';
import { ApplicationStatus, ReadingStatus } from '../enums';

describe('ApplicationSanitizationHelper', () => {
  describe('sanitizeBookForApplication', () => {
    it('returns null when book is null', () => {
      expect(ApplicationSanitizationHelper.sanitizeBookForApplication(null)).toBeNull();
    });

    it('removes fileUrl, fileSize, fileType from book', () => {
      const book = {
        id: 'b1',
        title: 'Title',
        fileUrl: 'https://example.com/file',
        fileSize: 1024,
        fileType: 'application/pdf',
      } as unknown as Book;

      const result = ApplicationSanitizationHelper.sanitizeBookForApplication(book);

      expect(result).toBeDefined();
      expect((result as any).fileUrl).toBeUndefined();
      expect((result as any).fileSize).toBeUndefined();
      expect((result as any).fileType).toBeUndefined();
      expect((result as any).id).toBe('b1');
      expect((result as any).title).toBe('Title');
    });
  });

  describe('shouldSanitizeBook', () => {
    it('returns true when not author, not approved, not reviewed', () => {
      const app = {
        status: ApplicationStatus.PENDING,
        readingStatus: ReadingStatus.NOT_STARTED,
      } as Application;
      expect(ApplicationSanitizationHelper.shouldSanitizeBook(app, false)).toBe(true);
    });

    it('returns false when is author', () => {
      const app = {
        status: ApplicationStatus.PENDING,
        readingStatus: ReadingStatus.NOT_STARTED,
      } as Application;
      expect(ApplicationSanitizationHelper.shouldSanitizeBook(app, true)).toBe(false);
    });

    it('returns false when status is APPROVED', () => {
      const app = {
        status: ApplicationStatus.APPROVED,
        readingStatus: ReadingStatus.NOT_STARTED,
      } as Application;
      expect(ApplicationSanitizationHelper.shouldSanitizeBook(app, false)).toBe(false);
    });

    it('returns false when readingStatus is REVIEWED', () => {
      const app = {
        status: ApplicationStatus.PENDING,
        readingStatus: ReadingStatus.REVIEWED,
      } as Application;
      expect(ApplicationSanitizationHelper.shouldSanitizeBook(app, false)).toBe(false);
    });
  });

  describe('sanitizeApplicationBook', () => {
    it('sanitizes book when shouldSanitizeBook is true and application has book', () => {
      const book = {
        id: 'b1',
        title: 'T',
        fileUrl: 'http://x',
        fileSize: 1,
        fileType: 'pdf',
      } as unknown as Book;
      const app = {
        status: ApplicationStatus.PENDING,
        readingStatus: ReadingStatus.NOT_STARTED,
        book,
      } as unknown as Application;

      const result = ApplicationSanitizationHelper.sanitizeApplicationBook(
        app,
        false,
      );

      expect(result).toBe(app);
      expect((result.book as any).fileUrl).toBeUndefined();
      expect((result.book as any).fileSize).toBeUndefined();
      expect((result.book as any).fileType).toBeUndefined();
    });

    it('does not sanitize when shouldSanitizeBook is false', () => {
      const book = {
        id: 'b1',
        fileUrl: 'http://x',
      } as Book;
      const app = {
        status: ApplicationStatus.APPROVED,
        readingStatus: ReadingStatus.NOT_STARTED,
        book,
      } as Application;

      ApplicationSanitizationHelper.sanitizeApplicationBook(app, false);

      expect((app.book as any).fileUrl).toBe('http://x');
    });

    it('does not mutate when application has no book', () => {
      const app = {
        status: ApplicationStatus.PENDING,
        readingStatus: ReadingStatus.NOT_STARTED,
        book: undefined,
      } as unknown as Application;

      const result = ApplicationSanitizationHelper.sanitizeApplicationBook(
        app,
        false,
      );

      expect(result).toBe(app);
      expect(result.book).toBeUndefined();
    });
  });

  describe('sanitizeApplications', () => {
    it('maps each application through sanitizeApplicationBook', () => {
      const app1 = {
        status: ApplicationStatus.PENDING,
        readingStatus: ReadingStatus.NOT_STARTED,
        book: { id: 'b1', fileUrl: 'u1' } as Book,
      } as Application;
      const app2 = {
        status: ApplicationStatus.PENDING,
        readingStatus: ReadingStatus.REVIEWED,
        book: { id: 'b2', fileUrl: 'u2' } as Book,
      } as Application;

      const result = ApplicationSanitizationHelper.sanitizeApplications(
        [app1, app2],
        false,
      );

      expect(result).toHaveLength(2);
      expect((result[0].book as any).fileUrl).toBeUndefined();
      expect((result[1].book as any).fileUrl).toBe('u2');
    });
  });
});
