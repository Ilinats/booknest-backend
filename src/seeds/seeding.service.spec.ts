import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SeedingService } from './seeding.service';
import { Genre } from '../genres/entity/genre.entity';
import { User } from '../users/entity/user.entity';
import { Book, BookGenre } from '../books/entity';
import { Series } from '../series/entity/series.entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { Friend } from '../friends/entity/friend.entity';
import { AuthorFollow } from '../author-follow/entity/author-follow.entity';
import { UserGenrePreference } from '../user-genre-preferences/entity/user-genre-preference.entity';
import { UserProfile } from '../user-profile/entity/user-profile.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { UserActivity } from '../user-activity/entity/user-activity.entity';
import { FilesService } from '../files/files.service';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  };
}

describe('SeedingService', () => {
  let service: SeedingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'SEED_USERS_PASSWORD' ? 'test-seed-password' : undefined,
            ),
          },
        },
        {
          provide: FilesService,
          useValue: {
            uploadFile: jest.fn(),
            uploadImage: jest.fn(),
          },
        },
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
          provide: getRepositoryToken(AuthorFollow),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(UserGenrePreference),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(UserProfile),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(UserAddress),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(UserActivity),
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
