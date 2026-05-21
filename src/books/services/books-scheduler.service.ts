import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Book } from '../entity/book.entity';
import { BookStatus, SelectionMethod } from '../enums';

@Injectable()
export class BooksSchedulerService {
  private readonly logger = new Logger(BooksSchedulerService.name);

  constructor(
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePassedDeadlines(): Promise<void> {
    this.logger.log('Running daily book status transition check...');

    try {
      const now = new Date();

      const nonLotteryActiveToInProgress = await this.bookRepo.update(
        {
          status: BookStatus.ACTIVE,
          applicationDeadline: LessThan(now),
          selectionMethod: Not(SelectionMethod.LOTTERY),
        },
        { status: BookStatus.IN_PROGRESS },
      );

      const lotteryActiveToInProgress = await this.bookRepo.update(
        {
          status: BookStatus.ACTIVE,
          applicationDeadline: LessThan(now),
          selectionMethod: SelectionMethod.LOTTERY,
          lotteryRunAt: Not(IsNull()),
        },
        { status: BookStatus.IN_PROGRESS },
      );

      const activeToInProgressAffected =
        (nonLotteryActiveToInProgress.affected ?? 0) +
        (lotteryActiveToInProgress.affected ?? 0);

      if (activeToInProgressAffected > 0) {
        this.logger.log(
          `Updated ${activeToInProgressAffected} book(s) from ACTIVE to IN_PROGRESS (application deadline passed).`,
        );
      }

      const inProgressToCompleted = await this.bookRepo.update(
        {
          status: BookStatus.IN_PROGRESS,
          reviewDeadline: LessThan(now),
        },
        { status: BookStatus.COMPLETED },
      );

      if (inProgressToCompleted.affected) {
        this.logger.log(
          `Updated ${inProgressToCompleted.affected} book(s) from IN_PROGRESS to COMPLETED (review deadline passed).`,
        );
      }

      if (!activeToInProgressAffected && !inProgressToCompleted.affected) {
        this.logger.log('No books required a status transition.');
      }
    } catch (error) {
      this.logger.error(
        `Error while processing books with passed deadlines: ${error.message}`,
        error.stack,
      );
    }
  }
}
