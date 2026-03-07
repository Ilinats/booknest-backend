import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeedingService } from './seeding.service';
import { Genre } from '../genres/entity/genre.entity';
import { User } from '../users/entity/user.entity';
import { Book, BookGenre } from '../books/entity';
import { Series } from '../series/entity/series.entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { Friend } from '../friends/entity/friend.entity';
import { UserGenrePreference } from '../user-genre-preferences/entity/user-genre-preference.entity';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
}

describe('SeedingService', () => {
  let service: SeedingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedingService,
        { provide: getRepositoryToken(Genre), useValue: createMockRepo() },
        { provide: getRepositoryToken(User), useValue: createMockRepo() },
        { provide: getRepositoryToken(Book), useValue: createMockRepo() },
        { provide: getRepositoryToken(BookGenre), useValue: createMockRepo() },
        { provide: getRepositoryToken(Series), useValue: createMockRepo() },
        {
          provide: getRepositoryToken(Application),
          useValue: createMockRepo(),
        },
        { provide: getRepositoryToken(Review), useValue: createMockRepo() },
        { provide: getRepositoryToken(Friend), useValue: createMockRepo() },
        {
          provide: getRepositoryToken(UserGenrePreference),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<SeedingService>(SeedingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('service should be constructible and expose seed method', () => {
    expect(typeof service.seed).toBe('function');
  });
});
