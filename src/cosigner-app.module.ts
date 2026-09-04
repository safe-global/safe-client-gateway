// SPDX-License-Identifier: FSL-1.1-MIT
import { BullModule } from '@nestjs/bullmq';
import { CacheModule as InMemoryCacheModule } from '@nestjs/cache-manager';
import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';
import { ConfigurationModule } from '@/config/configuration.module';
import { BlocklistModule } from '@/config/entities/blocklist.module';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { CacheModule } from '@/datasources/cache/cache.module';
import { CircuitBreakerModule } from '@/datasources/circuit-breaker/circuit-breaker.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NotFoundLoggerMiddleware } from '@/middleware/not-found-logger.middleware';
import { AboutModule } from '@/modules/about/about.module';
import { CloudCosignerModule } from '@/modules/cloud-cosigner/cloud-cosigner.module';
import { HealthModule } from '@/modules/health/health.module';
import { DataSourceErrorFilter } from '@/routes/common/filters/data-source-error.filter';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { ZodErrorFilter } from '@/routes/common/filters/zod-error.filter';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';
import { NullResponseInterceptor } from '@/routes/common/interceptors/null-response.interceptor';
import { RouteLoggerInterceptor } from '@/routes/common/interceptors/route-logger.interceptor';

/**
 * Root module of the cloud cosigner deployable (`src/cosigner.main.ts`). It
 * shares the gateway's infrastructure (configuration, cache, database, queue
 * and network layers) and the same global filters and interceptors, but
 * mounts only the cosigner feature plus health and about endpoints. The
 * gateway's `AppModule` never imports `CloudCosignerModule`, so the two
 * processes can be deployed and scaled independently.
 */
@Module({})
export class CosignerAppModule implements NestModule {
  static register(configFactory = configuration): DynamicModule {
    if (!configFactory().features.cloudCosigner) {
      throw new Error(
        'The cloud cosigner deployable requires FF_CLOUD_COSIGNER=true',
      );
    }

    return {
      module: CosignerAppModule,
      imports: [
        PostgresDatabaseModule,
        AboutModule,
        HealthModule,
        CloudCosignerModule,
        BlocklistModule,
        CacheModule,
        CircuitBreakerModule,
        ClsModule.forRoot({
          global: true,
          middleware: {
            generateId: true,
            idGenerator: () => crypto.randomUUID(),
          },
        }),
        ConfigurationModule.register(configFactory),
        InMemoryCacheModule.register({ isGlobal: true }),
        NetworkModule,
        RequestScopedLoggingModule,
        ScheduleModule.forRoot(),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (
            configService: ConfigService,
            loggingService: ILoggingService,
          ) => {
            const typeormConfig = configService.getOrThrow('db.orm');
            const cache = configService.get('db.orm.cache');
            const postgresConfigObject = postgresConfig(
              {
                ...configService.getOrThrow('db.connection.postgres'),
                cache,
              },
              loggingService,
            );
            return { ...typeormConfig, ...postgresConfigObject };
          },
          inject: [ConfigService, LoggingService],
        }),
        BullModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            connection: {
              host: configService.getOrThrow<string>('redis.host'),
              port: Number(configService.getOrThrow<string>('redis.port')),
              username: configService.get<string>('redis.user'),
              password: configService.get<string>('redis.pass'),
            },
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: RouteLoggerInterceptor },
        { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
        { provide: APP_INTERCEPTOR, useClass: NullResponseInterceptor },
        { provide: APP_FILTER, useClass: GlobalErrorFilter },
        { provide: APP_FILTER, useClass: DataSourceErrorFilter },
        { provide: APP_FILTER, useClass: ZodErrorFilter },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ClsMiddleware, NotFoundLoggerMiddleware)
      .forRoutes({ path: '{*any}', method: RequestMethod.ALL });
  }
}
