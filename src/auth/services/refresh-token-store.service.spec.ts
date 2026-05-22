import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenStoreService } from './refresh-token-store.service';
import { RedisService } from '../../redis/redis.service';

describe('RefreshTokenStoreService', () => {
  let service: RefreshTokenStoreService;
  let pipeline: {
    set: jest.Mock;
    sadd: jest.Mock;
    del: jest.Mock;
    srem: jest.Mock;
    exec: jest.Mock;
  };
  let redis: {
    get: jest.Mock;
    smembers: jest.Mock;
    del: jest.Mock;
    pipeline: jest.Mock;
  };

  beforeEach(async () => {
    pipeline = {
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    redis = {
      get: jest.fn(),
      smembers: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      pipeline: jest.fn().mockReturnValue(pipeline),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenStoreService,
        {
          provide: RedisService,
          useValue: { getClient: () => redis },
        },
      ],
    }).compile();

    service = module.get(RefreshTokenStoreService);
  });

  it('saves token with TTL and tracks hash in user set', async () => {
    await service.save('user-1', 'hash-abc', 3600);

    expect(pipeline.set).toHaveBeenCalledWith(
      'auth:refresh:hash-abc',
      'user-1',
      'EX',
      3600,
    );
    expect(pipeline.sadd).toHaveBeenCalledWith(
      'auth:refresh:user:user-1',
      'hash-abc',
    );
    expect(pipeline.exec).toHaveBeenCalled();
  });

  it('revokes token and removes hash from user set', async () => {
    redis.get.mockResolvedValue('user-1');

    await service.revoke('hash-abc');

    expect(pipeline.del).toHaveBeenCalledWith('auth:refresh:hash-abc');
    expect(pipeline.srem).toHaveBeenCalledWith(
      'auth:refresh:user:user-1',
      'hash-abc',
    );
  });

  it('revokes all tokens for a user', async () => {
    redis.smembers.mockResolvedValue(['hash-a', 'hash-b']);

    await service.revokeAllForUser('user-1');

    expect(pipeline.del).toHaveBeenCalledWith('auth:refresh:hash-a');
    expect(pipeline.del).toHaveBeenCalledWith('auth:refresh:hash-b');
    expect(pipeline.del).toHaveBeenCalledWith('auth:refresh:user:user-1');
    expect(pipeline.exec).toHaveBeenCalled();
  });
});
