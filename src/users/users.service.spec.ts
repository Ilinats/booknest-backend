import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entity/user.entity';
import { Book } from '../books/entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { FilesService } from '../files/files.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserType } from './enums';
import { ApplicationStatus, ReadingStatus } from '../applications/enums';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: MockRepo<User>;
  let bookRepository: MockRepo<Book>;
  let applicationRepository: MockRepo<Application>;
  let reviewRepository: MockRepo<Review>;
  let filesService: jest.Mocked<FilesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
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
        {
          provide: getRepositoryToken(Review),
          useValue: createMockRepo(),
        },
        {
          provide: FilesService,
          useValue: {
            uploadImage: jest.fn(),
            deleteFileByUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
    bookRepository = module.get(getRepositoryToken(Book));
    applicationRepository = module.get(getRepositoryToken(Application));
    reviewRepository = module.get(getRepositoryToken(Review));
    filesService = module.get(FilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException when user with username/email exists', async () => {
      usersRepository.findOne.mockResolvedValue({ id: 'u1' } as User);

      await expect(
        service.create({
          username: 'user',
          email: 'test@example.com',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should create and save new user when no conflict', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const user: User = {
        id: 'u1',
        username: 'user',
        email: 'test@example.com',
      } as any;

      usersRepository.create.mockReturnValue(user);
      usersRepository.save.mockResolvedValue(user);

      const result = await service.create({
        username: 'user',
        email: 'test@example.com',
        firstName: 'T',
        lastName: 'U',
        userType: UserType.READER,
      } as any);

      expect(usersRepository.create).toHaveBeenCalled();
      expect(usersRepository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });
  });

  describe('findOneById', () => {
    it('should throw NotFoundException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneById('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should return user when found', async () => {
      const user: User = {
        id: 'u1',
        username: 'user',
        email: 'test@example.com',
      } as any;
      usersRepository.findOne.mockResolvedValue(user);

      const result = await service.findOneById('u1');
      expect(result).toEqual(user);
    });
  });

  describe('findOneByIdResponse', () => {
    it('should return sanitized user with email when includeEmail true', async () => {
      const user: User = {
        id: 'u1',
        username: 'user',
        email: 'test@example.com',
      } as any;
      usersRepository.findOne.mockResolvedValue(user);

      const result = await service.findOneByIdResponse('u1', true);
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    it('should return public sanitized user when includeEmail false', async () => {
      const user: User = {
        id: 'u1',
        username: 'user',
        email: 'test@example.com',
      } as any;
      usersRepository.findOne.mockResolvedValue(user);

      const result = await service.findOneByIdResponse('u1', false);
      expect(result).not.toHaveProperty('email');
    });
  });

  describe('findByUsername', () => {
    it('should return user when found', async () => {
      const user: User = { id: 'u1', username: 'john' } as any;
      usersRepository.findOne.mockResolvedValue(user);

      const result = await service.findByUsername('john');
      expect(result).toEqual(user);
    });

    it('should return null when not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      const result = await service.findByUsername('nobody');
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should look up by lowercased email and return user', async () => {
      const user: User = { id: 'u1', email: 'test@example.com' } as any;
      usersRepository.findOne.mockResolvedValue(user);

      const result = await service.findByEmail('Test@Example.com');
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(user);
    });
  });

  describe('update', () => {
    const baseUser: User = {
      id: 'u1',
      username: 'user',
      email: 'test@example.com',
      firstName: 'T',
      lastName: 'U',
      isActive: true,
    } as any;

    it('should throw ConflictException when username/email duplicate exists', async () => {
      jest.spyOn(service, 'findOneById').mockResolvedValue(baseUser);
      usersRepository.findOne.mockResolvedValue({
        id: 'u2',
        username: 'other',
      } as any);

      await expect(
        service.update('u1', { username: 'other' } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should update user fields and return sanitized user', async () => {
      const user: User = { ...baseUser };
      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.save.mockImplementation(async (u) => u);

      const result: any = await service.update('u1', {
        firstName: 'New',
        isActive: false,
      } as any);

      expect(result.firstName).toBe('New');
    });

    it('should not throw when duplicate check returns same user (same id)', async () => {
      const user: User = { ...baseUser };
      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        username: 'user',
      } as any);
      usersRepository.save.mockImplementation(async (u) => u);

      const result: any = await service.update('u1', {
        username: 'user',
      } as any);
      expect(result).toBeDefined();
    });
  });

  describe('getProfile', () => {
    it('should throw NotFoundException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile('u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should return profile with stats when user exists', async () => {
      const user: User = {
        id: 'u1',
        username: 'user',
        email: 'test@example.com',
      } as any;
      usersRepository.findOne.mockResolvedValue(user);
      jest.spyOn(service, 'getUserStats').mockResolvedValue({
        userType: UserType.READER,
        totalReviews: 0,
      } as any);

      const result = await service.getProfile('u1');

      expect(result).toHaveProperty('stats');
      expect((result.stats as any).userType).toBe(UserType.READER);
    });
  });

  describe('updateProfile', () => {
    it('should throw when username taken by another user', async () => {
      const user: User = { id: 'u1', username: 'old' } as any;
      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      usersRepository.findOne.mockResolvedValue({
        id: 'u2',
        username: 'taken',
      } as any);

      await expect(
        service.updateProfile('u1', { username: 'taken' } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should update profile and set avatarUrl to null when empty string', async () => {
      const user: User = {
        id: 'u1',
        username: 'user',
        avatarUrl: 'old',
      } as any;
      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.save.mockImplementation(async (u: any) => u);

      const result: any = await service.updateProfile('u1', {
        firstName: 'New',
        avatarUrl: '',
      } as any);

      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: null }),
      );
    });

    it('should update profile and keep avatarUrl when undefined', async () => {
      const user: User = {
        id: 'u1',
        username: 'user',
        avatarUrl: 'keep',
      } as any;
      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      usersRepository.save.mockImplementation(async (u: any) => u);

      await service.updateProfile('u1', { firstName: 'New' } as any);

      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: 'keep' }),
      );
    });
  });

  describe('updateAvatar', () => {
    it('should set avatarUrl and return sanitized user', async () => {
      const user: User = { id: 'u1', username: 'user' } as any;
      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      usersRepository.save.mockImplementation(async (u: any) => u);

      const result: any = await service.updateAvatar(
        'u1',
        'https://cdn/avatar.png',
      );

      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: 'https://cdn/avatar.png' }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when nothing deleted', async () => {
      usersRepository.delete.mockResolvedValue({ affected: 0 } as any);

      await expect(service.remove('u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should succeed when delete affected > 0', async () => {
      usersRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await expect(service.remove('u1')).resolves.toBeUndefined();
    });
  });

  describe('uploadAvatar', () => {
    it('should throw BadRequestException when file missing', async () => {
      await expect(
        service.uploadAvatar('u1', undefined as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw BadRequestException when file has no buffer', async () => {
      await expect(
        service.uploadAvatar('u1', {
          buffer: undefined,
          originalname: 'x.jpg',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should not call deleteFileByUrl when user has no existing avatar', async () => {
      const user: User = { id: 'u1', avatarUrl: null } as any;
      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      jest
        .spyOn(service, 'updateAvatar')
        .mockResolvedValue({ id: 'u1', avatarUrl: 'new-url' } as any);
      (filesService.uploadImage as jest.Mock).mockResolvedValue({
        fileUrl: 'new-url',
        fileSize: 123,
        fileType: 'image/png',
      });
      const file: Express.Multer.File = {
        fieldname: 'avatar',
        originalname: 'avatar.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 123,
        buffer: Buffer.from('x'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      await service.uploadAvatar('u1', file);

      expect(filesService.deleteFileByUrl).not.toHaveBeenCalled();
      expect(filesService.uploadImage).toHaveBeenCalledWith(file, 'avatars');
    });

    it('should upload image, delete old avatar and update user', async () => {
      const user: User = {
        id: 'u1',
        avatarUrl: 'old-url',
      } as any;

      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      jest
        .spyOn(service, 'updateAvatar')
        .mockResolvedValue({ id: 'u1', avatarUrl: 'new-url' } as any);

      (filesService.uploadImage as jest.Mock).mockResolvedValue({
        fileUrl: 'new-url',
        fileSize: 123,
        fileType: 'image/png',
      });

      const file: Express.Multer.File = {
        fieldname: 'avatar',
        originalname: 'avatar.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 123,
        buffer: Buffer.from('test'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.uploadAvatar('u1', file);

      expect(filesService.deleteFileByUrl).toHaveBeenCalledWith('old-url');
      expect(filesService.uploadImage).toHaveBeenCalledWith(file, 'avatars');
      expect(result.avatar.url).toBe('new-url');
      expect(result.user.avatarUrl).toBe('new-url');
    });
  });

  describe('removeAvatar', () => {
    it('should remove avatar and return sanitized user when user had avatar', async () => {
      const user: User = {
        id: 'u1',
        username: 'user',
        avatarUrl: 'https://old/avatar.png',
      } as any;
      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      usersRepository.save.mockImplementation(async (u: any) => u);

      const result: any = await service.removeAvatar('u1');

      expect(filesService.deleteFileByUrl).toHaveBeenCalledWith(
        'https://old/avatar.png',
      );
      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: null }),
      );
      expect(result).toBeDefined();
    });

    it('should not call deleteFileByUrl when user has no avatar', async () => {
      const user: User = { id: 'u1', username: 'user', avatarUrl: null } as any;
      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      usersRepository.save.mockImplementation(async (u: any) => u);

      await service.removeAvatar('u1');

      expect(filesService.deleteFileByUrl).not.toHaveBeenCalled();
      expect(usersRepository.save).toHaveBeenCalled();
    });
  });

  describe('getUserStats', () => {
    it('should throw NotFoundException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserStats('u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should call getAuthorStatsData for author', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        userType: UserType.AUTHOR,
      } as any);

      const spy = jest
        .spyOn<any, any>(service as any, 'getAuthorStatsData')
        .mockResolvedValue({ userType: UserType.AUTHOR });

      const result = await service.getUserStats('u1');

      expect(spy).toHaveBeenCalledWith('u1');
      expect(result.userType).toBe(UserType.AUTHOR);
    });

    it('should call getReaderStatsData for reader', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        userType: UserType.READER,
      } as any);

      const spy = jest
        .spyOn<any, any>(service as any, 'getReaderStatsData')
        .mockResolvedValue({ userType: UserType.READER });

      const result = await service.getUserStats('u1');

      expect(spy).toHaveBeenCalledWith('u1');
      expect(result.userType).toBe(UserType.READER);
    });

    it('getAuthorStatsData returns full stats when repos return data', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'a1',
        userType: UserType.AUTHOR,
      } as any);
      bookRepository.count.mockResolvedValue(10);
      applicationRepository.count.mockResolvedValue(5);
      reviewRepository.count.mockResolvedValue(3);

      const chain = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest
          .fn()
          .mockResolvedValueOnce({ average: '4.5' })
          .mockResolvedValueOnce({ count: '2' })
          .mockResolvedValueOnce({ total: '100' }),
        getMany: jest.fn().mockResolvedValue([
          {
            appliedAt: new Date(),
            respondedAt: new Date(Date.now() + 86400000),
          },
        ]),
      };
      reviewRepository.createQueryBuilder.mockReturnValue(chain);
      applicationRepository.createQueryBuilder.mockReturnValue(chain);

      const result = (await service.getUserStats('a1')) as any;

      expect(result.userType).toBe(UserType.AUTHOR);
      expect(result.totalBooks).toBe(10);
      expect(result.publishedBooks).toBe(10);
      expect(result.totalApplications).toBe(5);
      expect(result.approvedApplications).toBe(5);
      expect(result.pendingApplications).toBe(0);
      expect(result.approvalRate).toBe(100);
    });

    it('getReaderStatsData returns full stats when repos return data', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'r1',
        userType: UserType.READER,
      } as any);
      applicationRepository.count.mockResolvedValue(4);
      reviewRepository.count.mockResolvedValue(2);

      const chain = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawOne: jest
          .fn()
          .mockResolvedValueOnce({ average: '4.0' })
          .mockResolvedValueOnce({ total: '50' })
          .mockResolvedValueOnce({ total: '200' }),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ genreId: 1, genreName: 'Fiction', count: 2 }]),
        getMany: jest.fn().mockResolvedValue([
          {
            readingStartedAt: new Date(0),
            readingCompletedAt: new Date(86400000),
          },
        ]),
      };
      reviewRepository.createQueryBuilder.mockReturnValue(chain);
      applicationRepository.createQueryBuilder.mockReturnValue(chain);

      const result = (await service.getUserStats('r1')) as any;

      expect(result.userType).toBe(UserType.READER);
      expect(result.totalApplications).toBe(4);
      expect(result.approvedApplications).toBe(4);
      expect(result.pendingApplications).toBe(0);
      expect(result.successRate).toBe(100);
      expect(result.completedReads).toBe(4);
      expect(result.totalReviews).toBe(2);
    });
  });

  describe('getAuthorStats', () => {
    it('should throw NotFoundException when author not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getAuthorStats('a1', 'req', UserType.READER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when user is not author', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        userType: UserType.READER,
      } as any);

      await expect(
        service.getAuthorStats('u1', 'u1', UserType.AUTHOR),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw ForbiddenException when access denied', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'a1',
        userType: UserType.AUTHOR,
      } as any);

      await expect(
        service.getAuthorStats('a1', 'req', UserType.READER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should return author and stats when author views own stats', async () => {
      const author: User = {
        id: 'a1',
        userType: UserType.AUTHOR,
        username: 'author',
        email: 'a@example.com',
      } as any;
      usersRepository.findOne.mockResolvedValue(author);
      jest
        .spyOn<any, any>(service as any, 'getAuthorStatsData')
        .mockResolvedValue({
          totalBooks: 5,
          publishedBooks: 3,
          userType: UserType.AUTHOR,
        });

      const result = await service.getAuthorStats('a1', 'a1', UserType.AUTHOR);

      expect(result.author).toBeDefined();
      expect(result.stats.userType).toBe(UserType.AUTHOR);
      expect(result.stats.totalBooks).toBe(5);
    });

    it('should return author and stats when another author requests', async () => {
      const author: User = {
        id: 'a1',
        userType: UserType.AUTHOR,
        username: 'author',
      } as any;
      usersRepository.findOne.mockResolvedValue(author);
      jest
        .spyOn<any, any>(service as any, 'getAuthorStatsData')
        .mockResolvedValue({ userType: UserType.AUTHOR });

      const result = await service.getAuthorStats('a1', 'a2', UserType.AUTHOR);

      expect(result.author).toBeDefined();
      expect(result.stats.userType).toBe(UserType.AUTHOR);
    });
  });

  describe('getMyStats', () => {
    it('should throw NotFoundException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.getMyStats('u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should return user and stats when user exists', async () => {
      const user: User = { id: 'u1', email: 'test@example.com' } as any;
      usersRepository.findOne.mockResolvedValue(user);

      jest
        .spyOn(service, 'getUserStats')
        .mockResolvedValue({ userType: UserType.READER } as any);

      const result = await service.getMyStats('u1');

      expect(result.user.id).toBe('u1');
      expect(result.stats.userType).toBe(UserType.READER);
    });
  });
});
