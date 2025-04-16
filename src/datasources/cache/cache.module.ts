import { Global, Module } from '@nestjs/common';
import { createClient } from 'redis';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { CacheReadiness } from '@/domain/interfaces/cache-readiness.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { LogType } from '@/domain/common/entities/log-type.entity';

export type RedisClientType = ReturnType<typeof createClient>;

async function redisClientFactory(
  configurationService: IConfigurationService,
  loggingService: ILoggingService,
): Promise<RedisClientType> {
  const redisUser = configurationService.get<string>('redis.user');
  const redisPass = configurationService.get<string>('redis.pass');
  const redisHost = configurationService.getOrThrow<string>('redis.host');
  const redisPort = configurationService.getOrThrow<string>('redis.port');
  const redisDisableOfflineQueue = configurationService.getOrThrow<boolean>(
    'redis.disableOfflineQueue',
  );
  const client: RedisClientType = createClient({
    socket: {
      host: redisHost,
      port: Number(redisPort),
    },
    username: redisUser,
    password: redisPass,
    disableOfflineQueue: redisDisableOfflineQueue,
  });
  client.on('error', (err) =>
    loggingService.error({
      type: LogType.CacheError,
      source: 'CacheModule',
      event: err.code ?? err.message,
    }),
  );
  client.on('reconnecting', () =>
    loggingService.warn({
      type: LogType.CacheEvent,
      source: 'CacheModule',
      event: 'Reconnecting to Redis',
    }),
  );
  client.on('end', () =>
    loggingService.warn({
      type: LogType.CacheEvent,
      source: 'CacheModule',
      event: 'Redis connection closed',
    }),
  );
  await client.connect();
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
    { provide: CacheReadiness, useExisting: CacheService },
    { provide: CacheKeyPrefix, useValue: '' },
  ],
  exports: [CacheService, CacheReadiness],
})
export class CacheModule {}
