import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, LessThan, Not } from 'typeorm';
import { BooksSchedulerService } from './books-scheduler.service';
import { Book } from '../entity/book.entity';
import { BookStatus, SelectionMethod } from '../enums';

type MockRepo = {
  update: jest.Mock;
};

function createMockRepo(): MockRepo {
  return {
    update: jest.fn().mockResolvedValue({ affected: 0 }),
  };
}

describe('BooksSchedulerService', () => {
  let service: BooksSchedulerService;
  let bookRepo: MockRepo;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksSchedulerService,
        {
          provide: getRepositoryToken(Book),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<BooksSchedulerService>(BooksSchedulerService);
    bookRepo = module.get(getRepositoryToken(Book));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handlePassedDeadlines', () => {
    it('should bulk-update books whose deadlines have passed', async () => {
      bookRepo.update
        .mockResolvedValueOnce({ affected: 1 })
        .mockResolvedValueOnce({ affected: 0 })
        .mockResolvedValueOnce({ affected: 2 });

      await service.handlePassedDeadlines();

      expect(bookRepo.update).toHaveBeenCalledTimes(3);

      const now = bookRepo.update.mock.calls[0][0].applicationDeadline
        .value as Date;
      expect(now).toBeInstanceOf(Date);

      expect(bookRepo.update).toHaveBeenNthCalledWith(
        1,
        {
          status: BookStatus.ACTIVE,
          applicationDeadline: LessThan(now),
          selectionMethod: Not(SelectionMethod.LOTTERY),
        },
        { status: BookStatus.IN_PROGRESS },
      );

      expect(bookRepo.update).toHaveBeenNthCalledWith(
        2,
        {
          status: BookStatus.ACTIVE,
          applicationDeadline: LessThan(now),
          selectionMethod: SelectionMethod.LOTTERY,
          lotteryRunAt: Not(IsNull()),
        },
        { status: BookStatus.IN_PROGRESS },
      );

      expect(bookRepo.update).toHaveBeenNthCalledWith(
        3,
        {
          status: BookStatus.IN_PROGRESS,
          reviewDeadline: LessThan(now),
        },
        { status: BookStatus.COMPLETED },
      );
    });

    it('should not log transitions when no books are affected', async () => {
      await service.handlePassedDeadlines();

      expect(bookRepo.update).toHaveBeenCalledTimes(3);
      expect(bookRepo.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          status: BookStatus.ACTIVE,
          selectionMethod: Not(SelectionMethod.LOTTERY),
        }),
        { status: BookStatus.IN_PROGRESS },
      );
      expect(bookRepo.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          status: BookStatus.ACTIVE,
          selectionMethod: SelectionMethod.LOTTERY,
        }),
        { status: BookStatus.IN_PROGRESS },
      );
      expect(bookRepo.update).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ status: BookStatus.IN_PROGRESS }),
        { status: BookStatus.COMPLETED },
      );
    });
  });
});
