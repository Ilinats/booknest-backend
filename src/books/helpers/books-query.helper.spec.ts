import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BooksQueryHelper } from './books-query.helper';
import { Book } from '../entity/book.entity';
import { BookGenre } from '../entity/book-genre.entity';
import { Application } from '../../applications/entity/application.entity';
import { Review } from '../../reviews/entity/review.entity';
import { UserGenrePreference } from '../../user-genre-preferences/entity/user-genre-preference.entity';
import { UserType } from '../../users/enums';
import { PaginateQuery } from 'nestjs-paginate';
import { ApplicationStatusFilter } from '../enums/application-status-filter.enum';
import { DeadlineFilter } from '../enums/deadline-filter.enum';
import { BookSortBy } from '../enums/book-sort.enum';

const mockPaginate = jest.fn();
jest.mock('nestjs-paginate', () => ({
  paginate: (...args: unknown[]) => mockPaginate(...args),
  FilterOperator: {
    EQ: '$eq',
    IN: '$in',
    ILIKE: '$ilike',
    GTE: '$gte',
    LTE: '$lte',
    BTW: '$btw',
    GT: '$gt',
  },
}));

type MockRepo = {
  createQueryBuilder: jest.Mock;
  find: jest.Mock;
  findAndCount: jest.Mock;
};

function createMockRepo(): MockRepo & Record<string, jest.Mock> {
  const chain: Record<string, jest.Mock> = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    getCount: jest.fn().mockResolvedValue(0),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
    subQuery: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      getQuery: jest.fn().mockReturnValue('(SELECT 1)'),
    }),
  };
  chain.clone.mockImplementation(() => chain);

  return {
    createQueryBuilder: jest.fn().mockReturnValue(chain),
    find: jest.fn(),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

describe('BooksQueryHelper', () => {
  let helper: BooksQueryHelper;
  let bookRepo: ReturnType<typeof createMockRepo>;
  let applicationRepo: ReturnType<typeof createMockRepo>;
  let userGenrePrefRepo: ReturnType<typeof createMockRepo>;

  beforeEach(async () => {
    mockPaginate.mockResolvedValue({
      data: [],
      meta: { totalItems: 0, itemsPerPage: 20, currentPage: 1, totalPages: 0 },
      links: {},
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksQueryHelper,
        { provide: getRepositoryToken(Book), useValue: createMockRepo() },
        { provide: getRepositoryToken(BookGenre), useValue: createMockRepo() },
        { provide: getRepositoryToken(Application), useValue: createMockRepo() },
        { provide: getRepositoryToken(Review), useValue: createMockRepo() },
        {
          provide: getRepositoryToken(UserGenrePreference),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    helper = module.get<BooksQueryHelper>(BooksQueryHelper);
    bookRepo = module.get(getRepositoryToken(Book));
    applicationRepo = module.get(getRepositoryToken(Application));
    userGenrePrefRepo = module.get(getRepositoryToken(UserGenrePreference));
  });

  describe('browse', () => {
    it('returns paginated result with sanitized data (simple path)', async () => {
      const books = [
        { id: 'b1', authorId: 'a1', title: 'Book 1' } as Book,
      ];
      mockPaginate.mockResolvedValue({
        data: books,
        meta: { totalItems: 1, itemsPerPage: 20, currentPage: 1, totalPages: 1 },
        links: {},
      });

      const result = await helper.browse({} as PaginateQuery);

      expect(mockPaginate).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.meta).toBeDefined();
    });

    it('sanitizes file fields when user is not author', async () => {
      const books = [
        {
          id: 'b1',
          authorId: 'a1',
          fileUrl: 'https://file',
          fileSize: 100,
          fileType: 'pdf',
        } as unknown as Book,
      ];
      mockPaginate.mockResolvedValue({
        data: books,
        meta: {},
        links: {},
      });

      const result = await helper.browse({} as PaginateQuery, 'reader-1', UserType.READER);

      expect(result.data[0].fileUrl).toBeUndefined();
      expect(result.data[0].fileSize).toBeUndefined();
      expect(result.data[0].fileType).toBeUndefined();
    });

    it('keeps file fields when user is author', async () => {
      const books = [
        {
          id: 'b1',
          authorId: 'author-1',
          fileUrl: 'https://file',
        } as unknown as Book,
      ];
      mockPaginate.mockResolvedValue({
        data: books,
        meta: {},
        links: {},
      });

      const result = await helper.browse(
        {} as PaginateQuery,
        'author-1',
        UserType.AUTHOR,
      );

      expect(result.data[0].fileUrl).toBe('https://file');
    });

    it('uses complex path when query has sortBy other than NEWEST', async () => {
      mockPaginate.mockResolvedValue({ data: [], meta: {}, links: {} });

      await helper.browse({
        sortBy: 'most_popular',
      } as unknown as PaginateQuery);

      expect(mockPaginate).toHaveBeenCalled();
      const [, qbOrRepo] = mockPaginate.mock.calls[0];
      expect(bookRepo.createQueryBuilder).toHaveBeenCalled();
      expect(qbOrRepo).toBeDefined();
    });
  });

  describe('featured', () => {
    it('returns up to 10 active books with available copies', async () => {
      const books = [{ id: 'b1', authorId: 'a1' } as Book];
      const qb = bookRepo.createQueryBuilder();
      qb.getMany = jest.fn().mockResolvedValue(books);

      const result = await helper.featured();

      expect(bookRepo.createQueryBuilder).toHaveBeenCalledWith('book');
      expect(qb.where).toHaveBeenCalled();
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });

    it('sanitizes books when user is reader', async () => {
      const books = [
        {
          id: 'b1',
          authorId: 'a1',
          fileUrl: 'https://x',
        } as unknown as Book,
      ];
      const qb = bookRepo.createQueryBuilder();
      qb.getMany = jest.fn().mockResolvedValue(books);

      const result = await helper.featured('reader-1', UserType.READER);

      expect(result[0].fileUrl).toBeUndefined();
    });
  });

  describe('recommendedForUser', () => {
    it('returns accepting books when userId empty', async () => {
      bookRepo.findAndCount.mockResolvedValue([[{ id: 'b1' } as Book], 1]);

      const result = await helper.recommendedForUser(
        '' as string,
        {} as PaginateQuery,
        UserType.READER,
      );

      expect(result.data).toHaveLength(1);
      expect(userGenrePrefRepo.find).not.toHaveBeenCalled();
    });

    it('returns accepting books when user has no genre preferences', async () => {
      userGenrePrefRepo.find.mockResolvedValue([]);
      bookRepo.findAndCount.mockResolvedValue([[{ id: 'b1' } as Book], 1]);

      const result = await helper.recommendedForUser(
        'user-1',
        {} as PaginateQuery,
        UserType.READER,
      );

      expect(userGenrePrefRepo.find).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('returns genre-based recommendations when user has preferences', async () => {
      userGenrePrefRepo.find.mockResolvedValue([
        { genre: { id: 1 } },
        { genre: { id: 2 } },
      ]);
      bookRepo.findAndCount.mockResolvedValue([
        [{ id: 'b1', authorId: 'a1' } as Book],
        1,
      ]);

      const result = await helper.recommendedForUser(
        'user-1',
        { limit: 10, path: '/books/recommended' } as unknown as PaginateQuery,
        UserType.READER,
      );

      expect(result.data).toHaveLength(1);
      expect(bookRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          where: expect.objectContaining({
            bookGenres: { genreId: expect.anything() },
          }),
        }),
      );
    });

    it('retries without genre filter when genre match is empty', async () => {
      userGenrePrefRepo.find.mockResolvedValue([{ genre: { id: 1 } }]);
      bookRepo.findAndCount
        .mockResolvedValueOnce([[], 0])
        .mockResolvedValueOnce([[{ id: 'b1' } as Book], 1]);

      const result = await helper.recommendedForUser(
        'user-1',
        {} as PaginateQuery,
      );

      expect(bookRepo.findAndCount).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('trending', () => {
    it('returns books with application counts', async () => {
      const appQb = applicationRepo.createQueryBuilder();
      appQb.getRawMany = jest
        .fn()
        .mockResolvedValue([{ bookId: 'b1', applicationCount: '5' }]);
      bookRepo.find.mockResolvedValue([{ id: 'b1', authorId: 'a1' } as Book]);

      const result = await helper.trending({ limit: 5 });

      expect(applicationRepo.createQueryBuilder).toHaveBeenCalled();
      expect(appQb.innerJoin).toHaveBeenCalledWith('application.book', 'book');
      expect(appQb.limit).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(1);
      expect(result[0].applicationCount).toBe(5);
    });

    it('uses default limit 10 when opts not provided', async () => {
      const appQb = applicationRepo.createQueryBuilder();
      appQb.getRawMany = jest.fn().mockResolvedValue([]);

      await helper.trending(undefined, 'user-1', UserType.READER);

      expect(appQb.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('browse with filters', () => {
    it('uses complex path when applicationStatus ACCEPTING_APPLICATIONS', async () => {
      mockPaginate.mockResolvedValue({ data: [], meta: {}, links: {} });

      await helper.browse({
        applicationStatus: ApplicationStatusFilter.ACCEPTING_APPLICATIONS,
      } as unknown as PaginateQuery);

      expect(bookRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockPaginate).toHaveBeenCalled();
    });

    it('uses complex path when genres provided', async () => {
      mockPaginate.mockResolvedValue({ data: [], meta: {}, links: {} });

      await helper.browse({ genres: [1, 2] } as unknown as PaginateQuery);

      expect(bookRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockPaginate).toHaveBeenCalled();
    });

    it('uses complex path when deadlineFilter provided', async () => {
      mockPaginate.mockResolvedValue({ data: [], meta: {}, links: {} });

      await helper.browse({
        deadlineFilter: DeadlineFilter.ENDING_SOON,
      } as unknown as PaginateQuery);

      expect(bookRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('uses complex path when sortBy is DEADLINE_SOONEST', async () => {
      mockPaginate.mockResolvedValue({ data: [], meta: {}, links: {} });

      await helper.browse({
        sortBy: BookSortBy.DEADLINE_SOONEST,
      } as unknown as PaginateQuery);

      const qb = bookRepo.createQueryBuilder();
      expect(qb.addOrderBy).toHaveBeenCalled();
    });
  });
});
