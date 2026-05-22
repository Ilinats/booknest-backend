import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalyticsCacheService } from './analytics-cache.service';
import { RedisService } from '../../redis/redis.service';

describe('AnalyticsCacheService', () => {
  let service: AnalyticsCacheService;
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsCacheService,
        {
          provide: RedisService,
          useValue: { getClient: () => redis },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'ANALYTICS_CACHE_TTL' ? '10m' : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get(AnalyticsCacheService);
  });

  it('stores factory result in redis on miss', async () => {
    const factory = jest.fn().mockResolvedValue({ total: 3 });

    const result = await service.getOrSet('book-stats:book-1', factory);

    expect(result).toEqual({ total: 3 });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      'analytics:book-stats:book-1',
      JSON.stringify({ total: 3 }),
      'EX',
      600,
    );
  });

  it('returns cached json on hit without calling factory', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ total: 9 }));
    const factory = jest.fn();

    const result = await service.getOrSet('book:book-1', factory);

    expect(result).toEqual({ total: 9 });
    expect(factory).not.toHaveBeenCalled();
  });
});
