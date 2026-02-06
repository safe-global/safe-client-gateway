import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule as InMemoryCacheModule } from '@nestjs/cache-manager';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';
import { join } from 'path';
import { ChainsModule } from '@/modules/chains/chains.module';
import { BalancesModule } from '@/modules/balances/balances.module';
import { PositionsModule } from '@/modules/positions/positions.module';
import { PortfolioModule } from '@/modules/portfolio/portfolio.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { ConfigurationModule } from '@/config/configuration.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { CollectiblesModule } from '@/modules/collectibles/collectibles.module';
import { CommunityModule } from '@/modules/community/community.module';
import { ContractsModule } from '@/modules/contracts/contracts.module';
import { DataDecoderModule } from '@/modules/data-decoder/data-decoder.module';
import { DelegateModule } from '@/modules/delegate/delegate.module';
import { HooksModule } from '@/modules/hooks/hooks.module';
import { SafeAppsModule } from '@/modules/safe-apps/safe-apps.module';
import { HealthModule } from '@/modules/health/health.module';
import { OwnersModule } from '@/modules/owners/owners.module';
import { AboutModule } from '@/modules/about/about.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { SafeModule } from '@/modules/safe/safe.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { EstimationsModule } from '@/modules/estimations/estimations.module';
import { MessagesModule } from '@/modules/messages/messages.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { RouteLoggerInterceptor } from '@/routes/common/interceptors/route-logger.interceptor';
import { NotFoundLoggerMiddleware } from '@/middleware/not-found-logger.middleware';
import { BlocklistGuard } from '@/routes/common/guards/blocklist.guard';
import configuration from '@/config/entities/configuration';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { DataSourceErrorFilter } from '@/routes/common/filters/data-source-error.filter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { RootModule } from '@/modules/root/root.module';
import { AlertsModule } from '@/modules/alerts/alerts.module';
import { RecoveryModule } from '@/modules/recovery/recovery.module';
import { RelayModule } from '@/modules/relay/relay.module';
import { ZodErrorFilter } from '@/routes/common/filters/zod-error.filter';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';
import { AuthModule } from '@/modules/auth/auth.module';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { TargetedMessagingModule } from '@/modules/targeted-messaging/targeted-messaging.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { postgresConfig } from '@/config/entities/postgres.config';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { UsersModule } from '@/modules/users/users.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { BullModule } from '@nestjs/bullmq';
import { CsvExportModule } from '@/modules/csv-export/csv-export.module';
import { SafeShieldModule } from '@/modules/safe-shield/safe-shield.module';
import { CircuitBreakerModule } from '@/datasources/circuit-breaker/circuit-breaker.module';

@Module({})
export class AppModule implements NestModule {
  static register(configFactory = configuration): DynamicModule {
    const {
      auth: isAuthFeatureEnabled,
      accounts: isAccountsFeatureEnabled,
      users: isUsersFeatureEnabled,
      email: isEmailFeatureEnabled,
      zerionPositions: isZerionPositionsFeatureEnabled,
    } = configFactory()['features'];

    return {
      module: AppModule,
      imports: [
        PostgresDatabaseModule,
        // features
        AboutModule,
        ...(isAccountsFeatureEnabled ? [AccountsModule] : []),
        ...(isAuthFeatureEnabled ? [AuthModule] : []),
        BalancesModule,
        ...(isZerionPositionsFeatureEnabled ? [PositionsModule] : []),
        PortfolioModule,
        ChainsModule,
        CollectiblesModule,
        CommunityModule,
        ContractsModule,
        CsvExportModule,
        DataDecoderModule,
        DelegateModule,
        // Note: this feature will not work as expected until we reintegrate the email service
        ...(isEmailFeatureEnabled ? [AlertsModule, RecoveryModule] : []),
        EstimationsModule,
        HealthModule,
        HooksModule,
        NotificationsModule,
        MessagesModule,
        ...(isUsersFeatureEnabled ? [UsersModule, SpacesModule] : []),
        OwnersModule,
        RelayModule,
        RootModule,
        SafeAppsModule,
        SafeModule,
        SafeShieldModule,
        TargetedMessagingModule,
        TransactionsModule,
        // common
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
