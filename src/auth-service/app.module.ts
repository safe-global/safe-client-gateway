// SPDX-License-Identifier: FSL-1.1-MIT
import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule as InMemoryCacheModule } from '@nestjs/cache-manager';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';
import { join } from 'path';
import { NetworkModule } from '@/datasources/network/network.module';
import { ConfigurationModule } from '@/config/configuration.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { HealthModule } from '@/modules/health/health.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { RouteLoggerInterceptor } from '@/routes/common/interceptors/route-logger.interceptor';
import { NotFoundLoggerMiddleware } from '@/middleware/not-found-logger.middleware';
import configuration from '@/auth-service/config/configuration';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { DataSourceErrorFilter } from '@/routes/common/filters/data-source-error.filter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ZodErrorFilter } from '@/routes/common/filters/zod-error.filter';
import { AuthModule } from '@/modules/auth/auth.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { postgresConfig } from '@/config/entities/postgres.config';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { CircuitBreakerModule } from '@/datasources/circuit-breaker/circuit-breaker.module';

/**
 * Auth Service App Module
 *
 * A minimal NestJS module that exposes only authentication-related functionality.
 * This module is designed to be deployed as a separate service from the main gateway.
 *
 * Includes:
 * - AuthModule (SIWE + JWT authentication)
 * - HealthModule (for health checks)
 * - Shared infrastructure (database, cache, logging)
 */
@Module({})
export class AuthAppModule implements NestModule {
  static register(configFactory = configuration): DynamicModule {
    return {
      module: AuthAppModule,
      imports: [
        // Database
        PostgresDatabaseModule,
        // Auth feature modules
        AuthModule,
        HealthModule.register({ includeQueues: false }),
        // Common infrastructure
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
        ServeStaticModule.forRoot({
          rootPath: join(__dirname, '..', '..', 'assets'),
          exclude: ['{*any}'],
        }),
        // Auth service uses its own database configuration (AUTH_DB_* env vars)
        // Falls back to main POSTGRES_* vars if not set
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

            return {
              ...typeormConfig,
              ...postgresConfigObject,
            };
          },
          inject: [ConfigService, LoggingService],
        }),
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: RouteLoggerInterceptor,
        },
        {
          provide: APP_FILTER,
          useClass: GlobalErrorFilter,
        },
        {
          provide: APP_FILTER,
          useClass: DataSourceErrorFilter,
        },
        {
          provide: APP_FILTER,
          useClass: ZodErrorFilter,
        },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ClsMiddleware, NotFoundLoggerMiddleware)
      .forRoutes({ path: '{*any}', method: RequestMethod.ALL });
  }
}
