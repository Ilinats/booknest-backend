import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeriesService } from './series.service';
import { Series } from './entity/series.entity';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SeriesErrorCode, SeriesErrors } from './errors/series-errors';
import { UserType } from '../users/enums';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    delete: jest.fn(),
  };
}

describe('SeriesService', () => {
  let service: SeriesService;
  let seriesRepo: MockRepo<Series>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeriesService,
        {
          provide: getRepositoryToken(Series),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<SeriesService>(SeriesService);
    seriesRepo = module.get(getRepositoryToken(Series));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateSeriesDto = {
      name: 'My Series',
      description: 'Description',
    };

    it('should create and save series for author', async () => {
      const entity: Series = {
        id: 'series-1',
        authorId: 'author-1',
        name: dto.name,
        description: dto.description,
      } as any;

      seriesRepo.create.mockReturnValue(entity);
      seriesRepo.save.mockResolvedValue(entity);

      const result = await service.create('author-1', UserType.AUTHOR, dto);

      expect(seriesRepo.create).toHaveBeenCalledWith({
        authorId: 'author-1',
        name: dto.name,
        description: dto.description,
      });
      expect(seriesRepo.save).toHaveBeenCalledWith(entity);
      expect(result).toEqual(entity);
    });
  });

  describe('listMine', () => {
    it('should return series for given author ordered by createdAt desc', async () => {
      const seriesList: Series[] = [
        { id: '1', authorId: 'author-1', name: 'S1' } as any,
      ];

      seriesRepo.find.mockResolvedValue(seriesList);

      const result = await service.listMine('author-1');

      expect(seriesRepo.find).toHaveBeenCalledWith({
        where: { authorId: 'author-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(seriesList);
    });
  });

  describe('update', () => {
    const dto: UpdateSeriesDto = {
      name: 'Updated Name',
      description: 'Updated description',
    };

    it('should throw NotFoundException when series not found', async () => {
      seriesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'series-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when authorId does not match', async () => {
      const series: Series = {
        id: 'series-1',
        authorId: 'other-author',
        name: 'Old',
        description: 'Old',
      } as any;

      seriesRepo.findOne.mockResolvedValue(series);

      await expect(
        service.update('author-1', UserType.AUTHOR, 'series-1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should merge and save series when valid', async () => {
      const series: Series = {
        id: 'series-1',
        authorId: 'author-1',
        name: 'Old',
        description: 'Old',
      } as any;

      const merged: Series = {
        ...series,
        name: dto.name!,
        description: dto.description!,
      };

      seriesRepo.findOne.mockResolvedValue(series);
      seriesRepo.merge.mockReturnValue(merged);
      seriesRepo.save.mockResolvedValue(merged);

      const result = await service.update(
        'author-1',
        UserType.AUTHOR,
        'series-1',
        dto,
      );

      expect(seriesRepo.merge).toHaveBeenCalledWith(series, {
        name: dto.name ?? series.name,
        description: dto.description ?? series.description,
      });
      expect(seriesRepo.save).toHaveBeenCalledWith(merged);
      expect(result).toEqual(merged);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when series not found', async () => {
      seriesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.remove('author-1', UserType.AUTHOR, 'series-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when authorId does not match', async () => {
      const series: Series = {
        id: 'series-1',
        authorId: 'other-author',
      } as any;

      seriesRepo.findOne.mockResolvedValue(series);

      await expect(
        service.remove('author-1', UserType.AUTHOR, 'series-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should delete series when valid', async () => {
      const series: Series = {
        id: 'series-1',
        authorId: 'author-1',
      } as any;

      seriesRepo.findOne.mockResolvedValue(series);

      await service.remove('author-1', UserType.AUTHOR, 'series-1');

      expect(seriesRepo.delete).toHaveBeenCalledWith('series-1');
    });
  });
});
