import { Repository } from 'typeorm';
import { Book } from '../../books/entity';
import { BookStatus } from '../../books/enums';

export class ApplicationBookHelper {
  static async decrementAvailableCopies(
    bookRepo: Repository<Book>,
    bookId: string,
    count: number = 1,
  ): Promise<void> {
    await bookRepo.decrement({ id: bookId }, 'availableCopies', count);

    const updatedBook = await bookRepo.findOne({ where: { id: bookId } });
    if (
      updatedBook &&
      updatedBook.availableCopies === 0 &&
      updatedBook.status === BookStatus.ACTIVE
    ) {
      updatedBook.status = BookStatus.IN_PROGRESS;
      await bookRepo.save(updatedBook);
    }
  }

  static shouldSetCopySentAt(book: Book): boolean {
    return book.distributionType === 'digital';
  }
}
