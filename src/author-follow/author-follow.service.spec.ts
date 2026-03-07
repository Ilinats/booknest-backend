import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthorFollowService } from './author-follow.service';
import { AuthorFollow } from './entity/author-follow.entity';
import { User } from '../users/entity';
import { Book } from '../books/entity';
import { Application } from '../applications/entity/application.entity';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserType } from '../users/enums';
import { AuthorFollowErrorCode } from './errors';
import { BookStatus } from '../books/enums';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('AuthorFollowService', () => {
  let service: AuthorFollowService;
  let authorFollowRepository: MockRepo<AuthorFollow>;
  let userRepository: MockRepo<User>;
  let bookRepository: MockRepo<Book>;
  let applicationRepository: MockRepo<Application>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorFollowService,
        {
          provide: getRepositoryToken(AuthorFollow),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(Book),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(Application),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<AuthorFollowService>(AuthorFollowService);
    authorFollowRepository = module.get(getRepositoryToken(AuthorFollow));
    userRepository = module.get(getRepositoryToken(User));
    bookRepository = module.get(getRepositoryToken(Book));
    applicationRepository = module.get(getRepositoryToken(Application));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('followAuthor', () => {
    it('should throw BadRequestException when trying to follow self', async () => {
      await expect(
        service.followAuthor('user-1', 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw NotFoundException when author does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.followAuthor('reader-1', 'author-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'author-1', userType: UserType.AUTHOR },
      });
    });

    it('should throw ConflictException when already following', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'author-1',
        userType: UserType.AUTHOR,
      } as User);

      authorFollowRepository.findOne.mockResolvedValue({
        id: 'follow-1',
      } as AuthorFollow);

      await expect(
        service.followAuthor('reader-1', 'author-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should create and save follow when valid', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'author-1',
        userType: UserType.AUTHOR,
      } as User);
      authorFollowRepository.findOne.mockResolvedValue(null);

      const follow: AuthorFollow = {
        id: 'follow-1',
        followerId: 'reader-1',
        authorId: 'author-1',
      } as any;

      authorFollowRepository.create.mockReturnValue(follow);
      authorFollowRepository.save.mockResolvedValue(follow);

      const result = await service.followAuthor('reader-1', 'author-1');

      expect(authorFollowRepository.create).toHaveBeenCalledWith({
        followerId: 'reader-1',
        authorId: 'author-1',
      });
      expect(authorFollowRepository.save).toHaveBeenCalledWith(follow);
      expect(result).toEqual(follow);
    });
  });

  describe('unfollowAuthor', () => {
    it('should throw NotFoundException when not following', async () => {
      authorFollowRepository.findOne.mockResolvedValue(null);

      await expect(
        service.unfollowAuthor('reader-1', 'author-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should remove follow when exists', async () => {
      const follow: AuthorFollow = {
        id: 'follow-1',
        followerId: 'reader-1',
        authorId: 'author-1',
      } as any;

      authorFollowRepository.findOne.mockResolvedValue(follow);
      authorFollowRepository.remove.mockResolvedValue(follow);

      await service.unfollowAuthor('reader-1', 'author-1');

      expect(authorFollowRepository.remove).toHaveBeenCalledWith(follow);
    });
  });

  describe('getFollowedAuthors', () => {
    it('should call repository with correct options', async () => {
      const follows: AuthorFollow[] = [
        { id: 'follow-1', followerId: 'reader-1', authorId: 'author-1' } as any,
      ];
      authorFollowRepository.find.mockResolvedValue(follows);

      const result = await service.getFollowedAuthors('reader-1');

      expect(authorFollowRepository.find).toHaveBeenCalledWith({
        where: { followerId: 'reader-1' },
        relations: ['author'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(follows);
    });
  });

  describe('getAuthorFollowers', () => {
    it('should call repository with correct options', async () => {
      const follows: AuthorFollow[] = [
        { id: 'follow-1', followerId: 'reader-1', authorId: 'author-1' } as any,
      ];
      authorFollowRepository.find.mockResolvedValue(follows);

      const result = await service.getAuthorFollowers('author-1');

      expect(authorFollowRepository.find).toHaveBeenCalledWith({
        where: { authorId: 'author-1' },
        relations: ['follower'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(follows);
    });
  });

  describe('isFollowing', () => {
    it('should return true when follow exists', async () => {
      authorFollowRepository.findOne.mockResolvedValue({
        id: 'follow-1',
      } as AuthorFollow);

      const result = await service.isFollowing('reader-1', 'author-1');
      expect(result).toBe(true);
    });

    it('should return false when follow does not exist', async () => {
      authorFollowRepository.findOne.mockResolvedValue(null);

      const result = await service.isFollowing('reader-1', 'author-1');
      expect(result).toBe(false);
    });
  });

  describe('getFollowedAuthorIds', () => {
    it('should map author ids from follows', async () => {
      const follows: AuthorFollow[] = [
        { id: '1', authorId: 'a1', followerId: 'r1' } as any,
        { id: '2', authorId: 'a2', followerId: 'r1' } as any,
      ];
      authorFollowRepository.find.mockResolvedValue(follows);

      const result = await service.getFollowedAuthorIds('r1');

      expect(result).toEqual(['a1', 'a2']);
    });
  });

  describe('getBooksFromFollowedAuthors', () => {
    it('should return empty array when no followed authors', async () => {
      jest.spyOn(service, 'getFollowedAuthorIds').mockResolvedValue([]);

      const result = await service.getBooksFromFollowedAuthors('r1', 10);
      expect(result).toEqual([]);
    });

    it('should return books from followed authors not yet applied for', async () => {
      jest.spyOn(service, 'getFollowedAuthorIds').mockResolvedValue(['a1']);

      const books: Book[] = [
        {
          id: 'b1',
          authorId: 'a1',
          status: BookStatus.ACTIVE,
          availableCopies: 5,
          applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
          createdAt: new Date(),
          fileUrl: 'file',
          fileSize: 100,
          fileType: 'pdf',
        } as any,
        {
          id: 'b2',
          authorId: 'a1',
          status: BookStatus.ACTIVE,
          availableCopies: 5,
          applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
          createdAt: new Date(),
          fileUrl: 'file2',
          fileSize: 200,
          fileType: 'pdf',
        } as any,
      ];

      bookRepository.find.mockResolvedValue(books);

      const qbMock: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ application_bookId: 'b2' }]),
      };

      applicationRepository.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getBooksFromFollowedAuthors(
        'r1',
        10,
        UserType.READER,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b1');
      expect((result[0] as any).fileUrl).toBeUndefined();
    });

    it('should keep file fields when user is the author', async () => {
      jest.spyOn(service, 'getFollowedAuthorIds').mockResolvedValue(['a1']);

      const books: Book[] = [
        {
          id: 'b1',
          authorId: 'a1',
          status: BookStatus.ACTIVE,
          availableCopies: 5,
          applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
          createdAt: new Date(),
          fileUrl: 'file',
          fileSize: 100,
          fileType: 'pdf',
        } as any,
      ];

      bookRepository.find.mockResolvedValue(books);

      const qbMock: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      applicationRepository.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getBooksFromFollowedAuthors(
        'a1',
        10,
        UserType.AUTHOR,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b1');
      expect((result[0] as any).fileUrl).toBe('file');
    });
  });
});
