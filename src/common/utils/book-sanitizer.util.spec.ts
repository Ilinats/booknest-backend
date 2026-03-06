import {
  sanitizeBookForUser,
  sanitizeBooksForUser,
} from './book-sanitizer.util';
import { UserType } from '../../users/enums';
import { Book } from '../../books/entity/book.entity';

describe('book-sanitizer.util', () => {
  const baseBook: Book = {
    id: 'book-1',
    authorId: 'author-1',
    title: 'Test',
    fileUrl: 'file-url',
    fileSize: 123,
    fileType: 'pdf',
  } as any;

  describe('sanitizeBookForUser', () => {
    it('keeps file fields for author', () => {
      const result = sanitizeBookForUser(
        baseBook,
        'author-1',
        UserType.AUTHOR,
        false,
      );

      expect((result as any).fileUrl).toBe('file-url');
      expect((result as any).fileSize).toBe(123);
      expect((result as any).fileType).toBe('pdf');
    });

    it('keeps file fields when hasApprovedApplication is true', () => {
      const result = sanitizeBookForUser(
        baseBook,
        'reader-1',
        UserType.READER,
        true,
      );

      expect((result as any).fileUrl).toBe('file-url');
    });

    it('removes file fields for non-author without approved application', () => {
      const result = sanitizeBookForUser(
        baseBook,
        'reader-1',
        UserType.READER,
        false,
      );

      expect((result as any).fileUrl).toBeUndefined();
      expect((result as any).fileSize).toBeUndefined();
      expect((result as any).fileType).toBeUndefined();
    });
  });

  describe('sanitizeBooksForUser', () => {
    it('sanitizes all books when no userId is provided', async () => {
      const books = [baseBook];

      const result = await sanitizeBooksForUser(books);

      expect(result[0].fileUrl).toBeUndefined();
    });

    it('uses approved applications set to keep file info', async () => {
      const books = [baseBook, { ...baseBook, id: 'book-2' }];

      const getApproved = jest
        .fn()
        .mockResolvedValue(new Set<string>(['book-2']));

      const result = await sanitizeBooksForUser(
        books,
        'reader-1',
        UserType.READER,
        getApproved,
      );

      expect(result[0].fileUrl).toBeUndefined();
      expect(result[1].fileUrl).toBe('file-url');
    });

    it('keeps file info for author even without approved application', async () => {
      const books = [baseBook];
      const getApproved = jest.fn().mockResolvedValue(new Set<string>());

      const result = await sanitizeBooksForUser(
        books,
        'author-1',
        UserType.AUTHOR,
        getApproved,
      );

      expect(result[0].fileUrl).toBe('file-url');
    });
  });
});
