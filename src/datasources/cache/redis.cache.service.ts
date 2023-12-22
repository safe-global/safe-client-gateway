import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { RedisClientType } from '@/datasources/cache/cache.module';
import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { ICacheReadiness } from '@/domain/interfaces/cache-readiness.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class RedisCacheService
  implements ICacheService, ICacheReadiness, OnModuleDestroy
{
  private readonly quitTimeoutInSeconds: number = 2;
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject('RedisClient') private readonly client: RedisClientType,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  async ping(): Promise<unknown> {
    return this.client.ping();
  }

  async set(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds?: number,
  ): Promise<void> {
    if (!expireTimeSeconds || expireTimeSeconds <= 0) {
      return;
    }

    try {
      await this.client.hSet(cacheDir.key, cacheDir.field, value);
      await this.client.expire(cacheDir.key, expireTimeSeconds);
    } catch (error) {
      await this.client.hDel(cacheDir.key, cacheDir.field);
      throw error;
    }
  }

  async get(cacheDir: CacheDir): Promise<string | undefined> {
    return await this.client.hGet(cacheDir.key, cacheDir.field);
  }

  async deleteByKey(
    key: string,
    setInvalidationTime?: boolean,
  ): Promise<number> {
    // see https://redis.io/commands/unlink/
    const result = await this.client.unlink(key);
    if (setInvalidationTime) {
      await this.set(
        new CacheDir(`invalidationTimeMs:${key}`, ''),
        Date.now().toString(),
        this.defaultExpirationTimeInSeconds,
      );
    }
    return result;
  }

  async deleteByKeyPattern(pattern: string): Promise<void> {
    for await (const key of this.client.scanIterator({ MATCH: pattern })) {
      await this.client.unlink(key);
    }
  }

  /**
   * Closes the connection to Redis when the module associated with this service
   * is destroyed. This tries to gracefully close the connection. If the Redis
   * instance is not responding it invokes {@link forceQuit}.
   */
  async onModuleDestroy(): Promise<void> {
    this.loggingService.info('Closing Redis connection');
    const forceQuitTimeout = setTimeout(
      this.forceQuit.bind(this),
      this.quitTimeoutInSeconds * 1000,
    );
    await this.client.quit();
    clearTimeout(forceQuitTimeout);
    this.loggingService.info('Redis connection closed');
  }

  /**
   * Forces the closing of the Redis connection associated with this service.
   */
  private async forceQuit() {
    this.loggingService.warn('Forcing Redis connection close');
    await this.client.disconnect();
    this.loggingService.warn('Redis connection closed');
  }
}
