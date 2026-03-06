import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserGenrePreferencesService } from './user-genre-preferences.service';
import { UserGenrePreference } from './entity/user-genre-preference.entity';
import { Genre } from '../genres/entity/genre.entity';
import { User } from '../users/entity/user.entity';
import { NotFoundException } from '@nestjs/common';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
}

describe('UserGenrePreferencesService', () => {
  let service: UserGenrePreferencesService;
  let prefRepository: MockRepo<UserGenrePreference>;
  let genreRepository: MockRepo<Genre>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserGenrePreferencesService,
        {
          provide: getRepositoryToken(UserGenrePreference),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(Genre),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<UserGenrePreferencesService>(
      UserGenrePreferencesService,
    );
    prefRepository = module.get(getRepositoryToken(UserGenrePreference));
    genreRepository = module.get(getRepositoryToken(Genre));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listForUser', () => {
    it('should return preferences with genres for user', async () => {
      const prefs: UserGenrePreference[] = [
        { id: 1, user: { id: 'u1' } as any, genre: { id: 10 } as any } as any,
      ];

      prefRepository.find.mockResolvedValue(prefs);

      const result = await service.listForUser('u1');

      expect(prefRepository.find).toHaveBeenCalledWith({
        where: { user: { id: 'u1' } },
        relations: { genre: true },
      });
      expect(result).toEqual(prefs);
    });
  });

  describe('upsert', () => {
    const user: User = { id: 'u1' } as any;

    it('should throw NotFoundException when genre does not exist', async () => {
      genreRepository.findOne.mockResolvedValue(null);

      await expect(service.upsert(user, 10)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should create new preference when it does not exist', async () => {
      const genre: Genre = { id: 10 } as any;
      const pref: UserGenrePreference = {
        id: 1,
        user,
        genre,
      } as any;

      genreRepository.findOne.mockResolvedValue(genre);
      prefRepository.findOne.mockResolvedValue(null);
      prefRepository.create.mockReturnValue(pref);
      prefRepository.save.mockResolvedValue(pref);

      const result = await service.upsert(user, 10);

      expect(prefRepository.create).toHaveBeenCalledWith({ user, genre });
      expect(prefRepository.save).toHaveBeenCalledWith(pref);
      expect(result).toEqual(pref);
    });

    it('should update existing preference when found', async () => {
      const oldGenre: Genre = { id: 5 } as any;
      const newGenre: Genre = { id: 10 } as any;
      const existing: UserGenrePreference = {
        id: 1,
        user,
        genre: oldGenre,
      } as any;

      genreRepository.findOne.mockResolvedValue(newGenre);
      prefRepository.findOne.mockResolvedValue(existing);
      prefRepository.save.mockImplementation(async (p) => p);

      const result = await service.upsert(user, 10);

      expect(result.genre.id).toBe(10);
      expect(prefRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should do nothing when preference not found', async () => {
      prefRepository.findOne.mockResolvedValue(null);

      await service.remove('u1', 10);

      expect(prefRepository.remove).not.toHaveBeenCalled();
    });

    it('should remove preference when found', async () => {
      const pref: UserGenrePreference = {
        id: 1,
        user: { id: 'u1' } as any,
        genre: { id: 10 } as any,
      } as any;

      prefRepository.findOne.mockResolvedValue(pref);
      prefRepository.remove.mockResolvedValue(pref);

      await service.remove('u1', 10);

      expect(prefRepository.remove).toHaveBeenCalledWith(pref);
    });
  });
});
