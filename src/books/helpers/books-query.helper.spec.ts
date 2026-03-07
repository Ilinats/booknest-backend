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
};

function createMockRepo(): MockRepo & Record<string, jest.Mock> {
  const chain = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
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

  return {
    createQueryBuilder: jest.fn().mockReturnValue(chain),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

describe('BooksQueryHelper', () => {
  let helper: BooksQueryHelper;
  let bookRepo: ReturnType<typeof createMockRepo>;
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
    it('falls back to featured when userId empty', async () => {
      const qb = bookRepo.createQueryBuilder();
      qb.getMany = jest.fn().mockResolvedValue([{ id: 'b1' } as Book]);

      const result = await helper.recommendedForUser(
        '' as string,
        {} as PaginateQuery,
        UserType.READER,
      );

      expect(result.data).toBeDefined();
      expect(userGenrePrefRepo.find).not.toHaveBeenCalled();
    });

    it('falls back to featured when user has no genre preferences', async () => {
      userGenrePrefRepo.find.mockResolvedValue([]);
      const qb = bookRepo.createQueryBuilder();
      qb.getMany = jest.fn().mockResolvedValue([{ id: 'b1' } as Book]);

      const result = await helper.recommendedForUser(
        'user-1',
        {} as PaginateQuery,
        UserType.READER,
      );

      expect(userGenrePrefRepo.find).toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });

    it('returns genre-based recommendations when user has preferences', async () => {
      userGenrePrefRepo.find.mockResolvedValue([
        { genre: { id: 1 } },
        { genre: { id: 2 } },
      ]);
      mockPaginate.mockResolvedValue({
        data: [{ id: 'b1', authorId: 'a1' } as Book],
        meta: {},
        links: {},
      });

      const result = await helper.recommendedForUser(
        'user-1',
        {} as PaginateQuery,
        UserType.READER,
      );

      expect(result.data).toHaveLength(1);
    });

    it('falls back to featured when genre-based result is empty', async () => {
      userGenrePrefRepo.find.mockResolvedValue([{ genre: { id: 1 } }]);
      mockPaginate.mockResolvedValue({
        data: [],
        meta: {},
        links: {},
      });
      const qb = bookRepo.createQueryBuilder();
      qb.getMany = jest.fn().mockResolvedValue([{ id: 'b1' } as Book]);

      const result = await helper.recommendedForUser(
        'user-1',
        {} as PaginateQuery,
      );

      expect(result.data).toBeDefined();
    });
  });

  describe('trending', () => {
    it('returns books with application counts', async () => {
      const books = [{ id: 'b1', authorId: 'a1' } as Book];
      const qb = bookRepo.createQueryBuilder();
      qb.getRawAndEntities = jest.fn().mockResolvedValue({
        entities: books,
        raw: [{ applicationCount: '5' }],
      });

      const result = await helper.trending({ limit: 5 });

      expect(bookRepo.createQueryBuilder).toHaveBeenCalled();
      expect(qb.innerJoin).toHaveBeenCalledWith('book.applications', 'application');
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(1);
      expect(result[0].book).toBeDefined();
      expect(result[0].applicationCount).toBe(5);
    });

    it('uses default limit 10 when opts not provided', async () => {
      const qb = bookRepo.createQueryBuilder();
      qb.getRawAndEntities = jest.fn().mockResolvedValue({ entities: [], raw: [] });

      await helper.trending(undefined, 'user-1', UserType.READER);

      expect(qb.take).toHaveBeenCalledWith(10);
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
