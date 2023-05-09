import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service.interface';
import { RedisCacheService } from './redis.cache.service';
import { createClient } from 'redis';
import { IConfigurationService } from '../../config/configuration.service.interface';
import {
  ILoggingService,
  LoggingService,
} from '../../logging/logging.interface';

export type RedisClientType = ReturnType<typeof createClient>;

async function redisClientFactory(
  configurationService: IConfigurationService,
  loggingService: ILoggingService,
): Promise<RedisClientType> {
  const redisHost = configurationService.getOrThrow<string>('redis.host');
  const redisPort = configurationService.getOrThrow<string>('redis.port');
  const client: RedisClientType = createClient({
    url: `redis://${redisHost}:${redisPort}`,
  });
  client.on('error', (err) =>
    loggingService.error(`Redis client error: ${err}`),
  );
  client.connect();
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: 'RedisClient',
      useFactory: redisClientFactory,
      inject: [IConfigurationService, LoggingService],
    },
    { provide: CacheService, useClass: RedisCacheService },
  ],
  exports: [CacheService],
})
export class CacheModule {}
