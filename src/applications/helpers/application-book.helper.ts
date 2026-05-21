import { Repository } from 'typeorm';
import { Book } from '../../books/entity';
import { BookStatus } from '../../books/enums';

export class ApplicationBookHelper {
  static async tryReserveCopies(
    bookRepo: Repository<Book>,
    bookId: string,
    count: number,
  ): Promise<boolean> {
    if (count <= 0) {
      return true;
    }

    const result = await bookRepo
      .createQueryBuilder()
      .update(Book)
      .set({ availableCopies: () => 'available_copies - :count' })
      .where('id = :bookId AND available_copies >= :count')
      .setParameters({ bookId, count })
      .execute();

    const reserved = (result.affected ?? 0) > 0;
    if (reserved) {
      await this.syncBookStatusWhenDepleted(bookRepo, bookId);
    }

    return reserved;
  }

  static async syncBookStatusWhenDepleted(
    bookRepo: Repository<Book>,
    bookId: string,
  ): Promise<void> {
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
