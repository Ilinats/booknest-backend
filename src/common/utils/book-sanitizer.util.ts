import { Book } from '../../books/entity/book.entity';
import { UserType } from '../../users/enums';

export function sanitizeBookForUser(
  book: Book,
  userId?: string,
  userType?: UserType,
  hasApprovedApplication?: boolean,
): Book {
  const isAuthor = userType === UserType.AUTHOR && book.authorId === userId;

  const canSeeFileInfo = isAuthor || hasApprovedApplication === true;

  if (!canSeeFileInfo) {
    const sanitized = { ...book };
    delete sanitized.fileUrl;
    delete sanitized.fileSize;
    delete sanitized.fileType;
    return sanitized;
  }

  return book;
}

export async function sanitizeBooksForUser(
  books: Book[],
  userId?: string,
  userType?: UserType,
  getApprovedApplications?: (bookIds: string[]) => Promise<Set<string>>,
): Promise<Book[]> {
  if (!userId) {
    return books.map((book) => {
      const sanitized = { ...book };
      delete sanitized.fileUrl;
      delete sanitized.fileSize;
      delete sanitized.fileType;
      return sanitized;
    });
  }

  let approvedBookIds = new Set<string>();
  if (getApprovedApplications && books.length > 0) {
    const bookIds = books.map((b) => b.id);
    approvedBookIds = await getApprovedApplications(bookIds);
  }

  return books.map((book) => {
    const isAuthor = userType === UserType.AUTHOR && book.authorId === userId;
    const hasApprovedApplication = approvedBookIds.has(book.id);

    if (!isAuthor && !hasApprovedApplication) {
      const sanitized = { ...book };
      delete sanitized.fileUrl;
      delete sanitized.fileSize;
      delete sanitized.fileType;
      return sanitized;
    }

    return book;
  });
}
