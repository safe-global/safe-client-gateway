import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ICacheService } from './cache.service.interface';
import { RedisClientType } from './cache.module';
import { IConfigurationService } from '../../config/configuration.service.interface';
import * as winston from 'winston';

@Injectable()
export class RedisCacheService implements ICacheService, OnModuleDestroy {
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly quitTimeoutInSeconds: number = 2;

  constructor(
    @Inject('RedisClient') private readonly client: RedisClientType,
    @Inject(IConfigurationService)
    private readonly configuration: IConfigurationService,
  ) {
    this.defaultExpirationTimeInSeconds = this.configuration.getOrThrow<number>(
      'expirationTimeInSeconds.default',
    );
  }

  async set(
    key: string,
    field: string,
    value: string,
    expireTimeSeconds?: number,
  ): Promise<void> {
    try {
      await this.client.hSet(key, field, value);
      await this.client.expire(
        key,
        expireTimeSeconds ?? this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      await this.client.hDel(key, field);
      throw error;
    }
  }

  async get(key: string, field: string): Promise<string | undefined> {
    return await this.client.hGet(key, field);
  }

  async delete(key: string): Promise<number> {
    // see https://redis.io/commands/unlink/
    return await this.client.unlink(key);
  }

  /**
   * Closes the connection to Redis when the module associated with this service
   * is destroyed. This tries to gracefully close the connection. If the Redis
   * instance is not responding it invokes {@link forceQuit}.
   */
  async onModuleDestroy(): Promise<void> {
    winston.verbose('Closing Redis connection');
    const forceQuitTimeout = setTimeout(
      this.forceQuit.bind(this),
      this.quitTimeoutInSeconds * 1000,
    );
    await this.client.quit();
    clearTimeout(forceQuitTimeout);
    winston.verbose('Redis connection closed');
  }

  /**
   * Forces the closing of the Redis connection associated with this service.
   */
  private async forceQuit() {
    winston.verbose('Forcing Redis connection close');
    await this.client.disconnect();
    winston.verbose('Redis connection closed');
  }
}
