// SPDX-License-Identifier: FSL-1.1-MIT

import { join } from 'node:path';
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
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
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
import { AlertsModule } from '@/modules/alerts/alerts.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { OidcAuthModule } from '@/modules/auth/oidc/oidc-auth.module';
import { BalancesModule } from '@/modules/balances/balances.module';
import { ChainsModule } from '@/modules/chains/chains.module';
import { FeatureFlagsModule } from '@/modules/chains/feature-flags/feature-flags.module';
import { CollectiblesModule } from '@/modules/collectibles/collectibles.module';
import { CommunityModule } from '@/modules/community/community.module';
import { ContractsModule } from '@/modules/contracts/contracts.module';
import { CounterfactualSafesModule } from '@/modules/counterfactual-safes/counterfactual-safes.module';
import { CsvExportModule } from '@/modules/csv-export/csv-export.module';
import { DataDecoderModule } from '@/modules/data-decoder/data-decoder.module';
import { DelegateModule } from '@/modules/delegate/delegate.module';
import { EstimationsModule } from '@/modules/estimations/estimations.module';
import { FeesModule } from '@/modules/fees/fees.module';
import { HealthModule } from '@/modules/health/health.module';
import { HooksModule } from '@/modules/hooks/hooks.module';
import { MessagesModule } from '@/modules/messages/messages.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { OwnersModule } from '@/modules/owners/owners.module';
import { PortfolioModule } from '@/modules/portfolio/portfolio.module';
import { PositionsModule } from '@/modules/positions/positions.module';
import { RecoveryModule } from '@/modules/recovery/recovery.module';
import { RelayModule } from '@/modules/relay/relay.module';
import { RootModule } from '@/modules/root/root.module';
import { SafeModule } from '@/modules/safe/safe.module';
import { SafeAppsModule } from '@/modules/safe-apps/safe-apps.module';
import { SafeShieldModule } from '@/modules/safe-shield/safe-shield.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { TargetedMessagingModule } from '@/modules/targeted-messaging/targeted-messaging.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { UsersModule } from '@/modules/users/users.module';
import { DataSourceErrorFilter } from '@/routes/common/filters/data-source-error.filter';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { ZodErrorFilter } from '@/routes/common/filters/zod-error.filter';
import { BlocklistGuard } from '@/routes/common/guards/blocklist.guard';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';
import { RouteLoggerInterceptor } from '@/routes/common/interceptors/route-logger.interceptor';

@Module({})
export class AppModule implements NestModule {
  static register(configFactory = configuration): DynamicModule {
    const {
      auth: isAuthFeatureEnabled,
      oidc_auth: isOidcAuthFeatureEnabled,
      users: isUsersFeatureEnabled,
      email: isEmailFeatureEnabled,
      zerionPositions: isZerionPositionsFeatureEnabled,
    } = configFactory().features;

    return {
      module: AppModule,
      imports: [
        PostgresDatabaseModule,
        // features
        AboutModule,
        ...(isAuthFeatureEnabled ? [AuthModule] : []),
        ...(isOidcAuthFeatureEnabled ? [OidcAuthModule] : []),
        BalancesModule,
        ...(isZerionPositionsFeatureEnabled ? [PositionsModule] : []),
        PortfolioModule,
        ChainsModule,
        FeatureFlagsModule,
        CollectiblesModule,
        CommunityModule,
        ContractsModule,
        CsvExportModule,
        DataDecoderModule,
        DelegateModule,
        // Note: this feature will not work as expected until we reintegrate the email service
        ...(isEmailFeatureEnabled ? [AlertsModule, RecoveryModule] : []),
        EstimationsModule,
        FeesModule,
        HealthModule,
        HooksModule,
        NotificationsModule,
        MessagesModule,
        ...(isUsersFeatureEnabled
          ? [UsersModule, SpacesModule, CounterfactualSafesModule]
          : []),
        OwnersModule,
        RelayModule,
        RootModule,
        SafeAppsModule,
        SafeModule,
        SafeShieldModule,
        TargetedMessagingModule,
        TransactionsModule,
        // common
        BlocklistModule,
        CacheModule,
        CircuitBreakerModule,
        // Module for storing and reading from the async local storage
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
        ServeStaticModule.forRoot({
          rootPath: join(__dirname, '..', 'assets'),
          // Excludes the paths under '/' (base url) from being served as static content
          // If we do not exclude these paths, the service will try to find the file and
          // return 500 for files that do not exist instead of a 404
          exclude: ['{*any}'],
        }),
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
        {
          provide: APP_INTERCEPTOR,
          useClass: RouteLoggerInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: CacheControlInterceptor,
        },
        {
          provide: APP_GUARD,
          useClass: BlocklistGuard,
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
      // The ClsMiddleware needs to be applied before the LoggerMiddleware
      // in order to generate the request ids that will be logged afterward
      .apply(ClsMiddleware, NotFoundLoggerMiddleware)
      .forRoutes({ path: '{*any}', method: RequestMethod.ALL });
  }
}
