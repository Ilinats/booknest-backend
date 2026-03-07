import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenresService } from './genres.service';
import { Genre } from './entity/genre.entity';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    find: jest.fn(),
  };
}

describe('GenresService', () => {
  let service: GenresService;
  let genreRepository: MockRepo<Genre>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenresService,
        {
          provide: getRepositoryToken(Genre),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<GenresService>(GenresService);
    genreRepository = module.get(getRepositoryToken(Genre));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all genres ordered by name', async () => {
      const genres: Genre[] = [
        { id: '2', name: 'Fantasy' } as any,
        { id: '1', name: 'Action' } as any,
      ];

      genreRepository.find.mockResolvedValue(genres);

      const result = await service.findAll();

      expect(genreRepository.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
      });
      expect(result).toEqual(genres);
    });
  });
});
