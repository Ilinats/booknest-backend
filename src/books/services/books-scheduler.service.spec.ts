import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In, LessThan, Not, IsNull } from 'typeorm';
import { BooksSchedulerService } from './books-scheduler.service';
import { Book } from '../entity/book.entity';
import { BookStatus } from '../enums';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    find: jest.fn(),
    update: jest.fn(),
  };
}

describe('BooksSchedulerService', () => {
  let service: BooksSchedulerService;
  let bookRepo: MockRepo<Book>;

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
    it('should update statuses for books with passed deadlines', async () => {
      const activeBook: Book = {
        id: 'b1',
        status: BookStatus.ACTIVE,
        applicationDeadline: new Date(Date.now() - 1000),
      } as any;
      const inProgressBook: Book = {
        id: 'b2',
        status: BookStatus.IN_PROGRESS,
        reviewDeadline: new Date(Date.now() - 1000),
      } as any;

      bookRepo.find
        .mockResolvedValueOnce([activeBook])
        .mockResolvedValueOnce([inProgressBook]);

      await service.handlePassedDeadlines();
      expect(bookRepo.update).toHaveBeenCalled();
    });
  });
});
