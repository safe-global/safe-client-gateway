import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { IConfigurationService } from '../../config/configuration.service.interface';
import {
  ILoggingService,
  LoggingService,
} from '../../logging/logging.interface';
import { RedisClientType } from './cache.module';
import { ICacheService } from './cache.service.interface';
import { CacheDir } from './entities/cache-dir.entity';

@Injectable()
export class RedisCacheService implements ICacheService, OnModuleDestroy {
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly quitTimeoutInSeconds: number = 2;

  constructor(
    @Inject('RedisClient') private readonly client: RedisClientType,
    @Inject(IConfigurationService)
    private readonly configuration: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.defaultExpirationTimeInSeconds = this.configuration.getOrThrow<number>(
      'expirationTimeInSeconds.default',
    );
  }

  async set(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds?: number,
  ): Promise<void> {
    try {
      await this.client.hSet(cacheDir.key, cacheDir.field, value);
      await this.client.expire(
        cacheDir.key,
        expireTimeSeconds ?? this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      await this.client.hDel(cacheDir.key, cacheDir.field);
      throw error;
    }
  }

  async get(cacheDir: CacheDir): Promise<string | undefined> {
    return await this.client.hGet(cacheDir.key, cacheDir.field);
  }

  async deleteByKey(key: string): Promise<number> {
    // see https://redis.io/commands/unlink/
    return await this.client.unlink(key);
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
