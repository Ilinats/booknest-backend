import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, Not, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Book } from '../entity/book.entity';
import { BookStatus } from '../enums';

@Injectable()
export class BooksSchedulerService {
  private readonly logger = new Logger(BooksSchedulerService.name);

  constructor(
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePassedDeadlines(): Promise<void> {
    this.logger.log('Checking for books with passed application deadlines...');

    try {
      const now = new Date();

      const booksWithPassedDeadlines = await this.bookRepo.find({
        where: {
          status: BookStatus.ACTIVE,
          applicationDeadline: LessThan(now),
        },
      });

      if (booksWithPassedDeadlines.length > 0) {
        this.logger.log(
          `Found ${booksWithPassedDeadlines.length} book(s) with passed application deadlines. Updating to IN_PROGRESS...`,
        );

        const bookIds = booksWithPassedDeadlines.map((book) => book.id);
        const updateResult = await this.bookRepo.update(
          { id: In(bookIds) },
          { status: BookStatus.IN_PROGRESS },
        );

        this.logger.log(
          `Successfully updated ${updateResult.affected || 0} book(s) to IN_PROGRESS status.`,
        );
      }

      this.logger.log('Checking for books with passed review deadlines...');

      const booksWithPassedReviewDeadlines = await this.bookRepo.find({
        where: {
          status: BookStatus.IN_PROGRESS,
          reviewDeadline: Not(IsNull()),
        },
      });

      const booksToComplete = booksWithPassedReviewDeadlines.filter(
        (book) => book.reviewDeadline && book.reviewDeadline < now,
      );

      if (booksToComplete.length > 0) {
        this.logger.log(
          `Found ${booksToComplete.length} book(s) with passed review deadlines. Updating to COMPLETED...`,
        );

        const bookIds = booksToComplete.map((book) => book.id);
        const updateResult = await this.bookRepo.update(
          { id: In(bookIds) },
          { status: BookStatus.COMPLETED },
        );

        this.logger.log(
          `Successfully updated ${updateResult.affected || 0} book(s) to COMPLETED status.`,
        );
      }

      if (
        booksWithPassedDeadlines.length === 0 &&
        booksToComplete.length === 0
      ) {
        this.logger.log('No books with passed deadlines found.');
      }
    } catch (error) {
      this.logger.error(
        `Error while processing books with passed deadlines: ${error.message}`,
        error.stack,
      );
    }
  }
}
