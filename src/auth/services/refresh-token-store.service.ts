import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const tokenKey = (tokenHash: string): string => `auth:refresh:${tokenHash}`;
const userTokensKey = (userId: string): string => `auth:refresh:user:${userId}`;

@Injectable()
export class RefreshTokenStoreService {
  constructor(private readonly redisService: RedisService) {}

  async save(
    userId: string,
    tokenHash: string,
    ttlSeconds: number,
  ): Promise<void> {
    const redis = this.redisService.getClient();
    const pipeline = redis.pipeline();
    pipeline.set(tokenKey(tokenHash), userId, 'EX', ttlSeconds);
    pipeline.sadd(userTokensKey(userId), tokenHash);
    await pipeline.exec();
  }

  async getUserId(tokenHash: string): Promise<string | null> {
    return this.redisService.getClient().get(tokenKey(tokenHash));
  }

  async revoke(tokenHash: string): Promise<void> {
    const redis = this.redisService.getClient();
    const userId = await redis.get(tokenKey(tokenHash));
    const pipeline = redis.pipeline();
    pipeline.del(tokenKey(tokenHash));
    if (userId) {
      pipeline.srem(userTokensKey(userId), tokenHash);
    }
    await pipeline.exec();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const redis = this.redisService.getClient();
    const tokenHashes = await redis.smembers(userTokensKey(userId));
    if (tokenHashes.length === 0) {
      await redis.del(userTokensKey(userId));
      return;
    }

    const pipeline = redis.pipeline();
    for (const hash of tokenHashes) {
      pipeline.del(tokenKey(hash));
    }
    pipeline.del(userTokensKey(userId));
    await pipeline.exec();
  }
}
