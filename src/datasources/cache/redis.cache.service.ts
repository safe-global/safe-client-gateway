import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ICacheService } from './cache.service.interface';
import { RedisClientType } from './cache.module';
import { IConfigurationService } from '../../common/config/configuration.service.interface';

@Injectable()
export class RedisCacheService implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);

  private readonly defaultExpirationTimeInSeconds: number;

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
    value: any,
    expireTimeSeconds?: number,
  ): Promise<void> {
    try {
      await this.client.json.set(key, '$', value);
      await this.client.expire(
        key,
        expireTimeSeconds ?? this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      await this.client.json.del(key, '$');
      throw error;
    }
  }

  async get<T>(key: string): Promise<T> {
    return (await this.client.json.get(key)) as unknown as T;
  }

  /**
   * Closes the connection to Redis when the module associated with this service
   * is destroyed.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.verbose('Closing Redis connection');
    await this.client.quit();
    this.logger.verbose('Redis connection closed');
  }
}
