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
    leftJoin: jest.fn().mockReturnThis(),
    andHaving: jest.fn().mockReturnThis(),
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
    mockPaginate.mockReset();
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
    it('returns paginated result via nestjs-paginate', async () => {
      const books = [{ id: 'b1', authorId: 'a1', title: 'Book 1' } as Book];
      mockPaginate.mockResolvedValue({
        data: books,
        meta: { totalItems: 1, itemsPerPage: 20, currentPage: 1, totalPages: 1 },
        links: {},
      });

      const result = await helper.browse({} as PaginateQuery);

      expect(mockPaginate).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('scopes search and default sort', async () => {
      mockPaginate.mockResolvedValue({ data: [], meta: {}, links: {} });

      await helper.browse({ search: '  forest  ' } as PaginateQuery);

      expect(mockPaginate).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'forest',
          searchBy: [
            'title',
            'author.firstName',
            'author.lastName',
            'series.name',
          ],
          sortBy: [['publishedAt', 'DESC']],
        }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('passes genre filter to paginate', async () => {
      mockPaginate.mockResolvedValue({ data: [], meta: {}, links: {} });

      await helper.browse({
        filter: { 'bookGenres.genreId': '$in:13,18' },
      } as unknown as PaginateQuery);

      expect(mockPaginate).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            'bookGenres.genreId': '$in:13,18',
          }),
        }),
        expect.anything(),
        expect.anything(),
      );
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
      mockPaginate.mockResolvedValue({ data: books, meta: {}, links: {} });

      const result = await helper.browse(
        {} as PaginateQuery,
        'reader-1',
        UserType.READER,
      );

      expect(result.data[0].fileUrl).toBeUndefined();
    });

    it('uses custom SQL for mostPopular sort', async () => {
      const qb = bookRepo.createQueryBuilder();
      qb.getCount.mockResolvedValue(0);
      qb.getRawMany.mockResolvedValue([]);

      await helper.browse({
        sortBy: [['mostPopular', 'DESC']],
      } as PaginateQuery);

      expect(bookRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockPaginate).not.toHaveBeenCalled();
    });

    it('uses custom SQL for averageRating filter', async () => {
      const qb = bookRepo.createQueryBuilder();
      qb.getCount.mockResolvedValue(0);
      qb.getRawMany.mockResolvedValue([]);

      await helper.browse({
        filter: { averageRating: '$btw:3,5' },
      } as unknown as PaginateQuery);

      expect(bookRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockPaginate).not.toHaveBeenCalled();
    });
  });

  describe('featured', () => {
    it('returns up to 10 active books with available copies', async () => {
      const books = [{ id: 'b1', authorId: 'a1' } as Book];
      const qb = bookRepo.createQueryBuilder();
      qb.getMany = jest.fn().mockResolvedValue(books);

      const result = await helper.featured();

      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });
  });

  describe('recommendedForUser', () => {
    it('returns accepting books when user has no genre preferences', async () => {
      userGenrePrefRepo.find.mockResolvedValue([]);
      bookRepo.findAndCount.mockResolvedValue([[{ id: 'b1' } as Book], 1]);

      const result = await helper.recommendedForUser('user-1', {} as PaginateQuery);

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

      expect(result).toHaveLength(1);
      expect(result[0].applicationCount).toBe(5);
    });
  });
});
