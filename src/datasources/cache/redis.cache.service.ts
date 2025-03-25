import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { RedisClientType } from '@/datasources/cache/cache.module';
import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { ICacheReadiness } from '@/domain/interfaces/cache-readiness.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { LogType } from '@/domain/common/entities/log-type.entity';

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
    @Inject(CacheKeyPrefix) private readonly keyPrefix: string,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  async ping(): Promise<unknown> {
    return this.client.ping();
  }

  ready(): boolean {
    return this.client.isReady;
  }

  async getCounter(key: string): Promise<number | null> {
    const value = await this.client.get(this._prefixKey(key));
    const numericValue = Number(value);
    return Number.isInteger(numericValue) ? numericValue : null;
  }

  async hSet(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds: number | undefined,
  ): Promise<void> {
    if (!expireTimeSeconds || expireTimeSeconds <= 0) {
      return;
    }

    const key = this._prefixKey(cacheDir.key);

    try {
      await this.client.hSet(key, cacheDir.field, value);
      // NX - Set expiry only when the key has no expiry
      // See https://redis.io/commands/expire/
      await this.client.expire(key, expireTimeSeconds, 'NX');
    } catch (error) {
      this.loggingService.error({
        type: LogType.CacheError,
        source: 'RedisCacheService',
        message: `Error setting/expiring ${key}:${cacheDir.field}`,
      });
      await this.client.unlink(key);
      throw error;
    }
  }

  async hGet(cacheDir: CacheDir): Promise<string | undefined> {
    const key = this._prefixKey(cacheDir.key);
    return await this.client.hGet(key, cacheDir.field);
  }

  async deleteByKey(key: string): Promise<number> {
    const keyWithPrefix = this._prefixKey(key);
    // see https://redis.io/commands/unlink/
    const result = await this.client.unlink(keyWithPrefix);
    await this.hSet(
      new CacheDir(`invalidationTimeMs:${key}`, ''),
      Date.now().toString(),
      this.defaultExpirationTimeInSeconds,
    );
    return result;
  }

  async increment(
    cacheKey: string,
    expireTimeSeconds: number | undefined,
  ): Promise<number> {
    const transaction = this.client.multi().incr(cacheKey);
    if (expireTimeSeconds !== undefined && expireTimeSeconds > 0) {
      transaction.expire(cacheKey, expireTimeSeconds, 'NX');
    }
    const [incrRes] = await transaction.get(cacheKey).exec();
    return Number(incrRes);
  }

  async setCounter(
    key: string,
    value: number,
    expireTimeSeconds: number,
  ): Promise<void> {
    await this.client.set(key, value, { EX: expireTimeSeconds, NX: true });
  }

  /**
   * Constructs a prefixed key string.
   *
   * This function takes a key string as an input and prefixes it with `this.keyPrefix`.
   * If `this.keyPrefix` is empty, it returns the original key without any prefix.
   *
   * @param key - The original key string that needs to be prefixed.
   * @returns A string that combines `this.keyPrefix` and the original `key` with a hyphen.
   *          If `this.keyPrefix` is empty, the original `key` is returned without any modification.
   * @private
   */
  private _prefixKey(key: string): string {
    if (this.keyPrefix.length === 0) {
      return key;
    }

    return `${this.keyPrefix}-${key}`;
  }

  /**
   * Closes the connection to Redis when the module associated with this service
   * is destroyed. This tries to gracefully close the connection. If the Redis
   * instance is not responding it invokes {@link forceQuit}.
   */
  async onModuleDestroy(): Promise<void> {
    this.loggingService.warn({
      type: LogType.CacheEvent,
      source: 'RedisCacheService',
      message: 'Closing Redis connection',
    });
    const forceQuitTimeout = setTimeout(() => {
      this.forceQuit.bind(this);
    }, this.quitTimeoutInSeconds * 1000);
    await this.client.quit();
    clearTimeout(forceQuitTimeout);
  }

  /**
   * Forces the closing of the Redis connection associated with this service.
   */
  private async forceQuit(): Promise<void> {
    this.loggingService.warn({
      type: LogType.CacheEvent,
      source: 'RedisCacheService',
      message: 'Forcing Redis connection close',
    });
    await this.client.disconnect();
  }
}
