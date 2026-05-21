import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ms = require('ms') as (value: string) => number;

const DEFAULT_TTL = '5m';

@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly redisService: RedisService,
    configService: ConfigService,
  ) {
    const spec = configService.get<string>('ANALYTICS_CACHE_TTL')?.trim();
    let ttlMs = ms(spec && spec.length > 0 ? spec : DEFAULT_TTL);
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      ttlMs = ms(DEFAULT_TTL);
    }
    this.ttlSeconds = Math.ceil(ttlMs / 1000);
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const cacheKey = `analytics:${key}`;

    try {
      const cached = await this.redisService.getClient().get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      this.logger.warn(
        `Analytics cache read failed for ${cacheKey}, loading fresh data`,
        error instanceof Error ? error.message : error,
      );
    }

    const value = await factory();

    try {
      await this.redisService
        .getClient()
        .set(cacheKey, JSON.stringify(value), 'EX', this.ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Analytics cache write failed for ${cacheKey}`,
        error instanceof Error ? error.message : error,
      );
    }

    return value;
  }
}
