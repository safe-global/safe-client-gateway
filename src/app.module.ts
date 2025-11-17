import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule as InMemoryCacheModule } from '@nestjs/cache-manager';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';
import { join } from 'path';
import { ChainsModule } from '@/modules/chains/routes/chains.module';
import { BalancesModule } from '@/modules/balances/routes/balances.module';
import { PositionsModule } from '@/modules/positions/routes/positions.module';
import { PortfolioModule } from '@/modules/portfolio/v1/portfolio.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { ConfigurationModule } from '@/config/configuration.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { CollectiblesModule } from '@/modules/collectibles/routes/collectibles.module';
import { CommunityModule } from '@/modules/community/routes/community.module';
import { ContractsModule } from '@/modules/contracts/routes/contracts.module';
import { DataDecodedModule } from '@/modules/data-decoder/routes/data-decoded.module';
import { DelegatesModule } from '@/modules/delegate/routes/delegates.module';
import { HooksModule } from '@/modules/hooks/routes/hooks.module';
import { SafeAppsModule } from '@/modules/safe-apps/routes/safe-apps.module';
import { HealthModule } from '@/modules/health/routes/health.module';
import { OwnersModule } from '@/modules/owners/routes/owners.module';
import { AboutModule } from '@/modules/about/routes/about.module';
import { TransactionsModule } from '@/modules/transactions/routes/transactions.module';
import { SafesModule } from '@/modules/safe/routes/safes.module';
import { NotificationsModule } from '@/modules/notifications/routes/v1/notifications.module';
import { EstimationsModule } from '@/modules/estimations/routes/estimations.module';
import { MessagesModule } from '@/modules/messages/routes/messages.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { RouteLoggerInterceptor } from '@/routes/common/interceptors/route-logger.interceptor';
import { NotFoundLoggerMiddleware } from '@/middleware/not-found-logger.middleware';
import configuration from '@/config/entities/configuration';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { DataSourceErrorFilter } from '@/routes/common/filters/data-source-error.filter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { RootModule } from '@/modules/root/routes/root.module';
import { AlertsControllerModule } from '@/modules/alerts/routes/alerts.controller.module';
import { RecoveryModule } from '@/modules/recovery/routes/recovery.module';
import { RelayControllerModule } from '@/modules/relay/routes/relay.controller.module';
import { ZodErrorFilter } from '@/routes/common/filters/zod-error.filter';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';
import { AuthModule } from '@/modules/auth/routes/auth.module';
import { DelegatesV2Module } from '@/modules/delegate/routes/v2/delegates.v2.module';
import { AccountsModule } from '@/modules/accounts/routes/accounts.module';
import { NotificationsModuleV2 } from '@/modules/notifications/routes/v2/notifications.module';
import { TargetedMessagingModule } from '@/modules/targeted-messaging/routes/targeted-messaging.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { postgresConfig } from '@/config/entities/postgres.config';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { UsersModule } from '@/modules/users/routes/users.module';
import { SpacesModule } from '@/modules/spaces/routes/spaces.module';
import { MembersModule } from '@/modules/spaces/routes/members.module';
import { BullModule } from '@nestjs/bullmq';
import { CsvExportModule } from '@/modules/csv-export/v1/csv-export.module';
import { SafeShieldModule } from '@/modules/safe-shield/safe-shield.module';

@Module({})
export class AppModule implements NestModule {
  static register(configFactory = configuration): DynamicModule {
    const {
      auth: isAuthFeatureEnabled,
      accounts: isAccountsFeatureEnabled,
      users: isUsersFeatureEnabled,
      email: isEmailFeatureEnabled,
      delegatesV2: isDelegatesV2Enabled,
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
        DataDecodedModule,
        // TODO: delete/rename DelegatesModule when clients migration to v2 is completed.
        DelegatesModule,
        ...(isDelegatesV2Enabled ? [DelegatesV2Module] : []),
        // Note: this feature will not work as expected until we reintegrate the email service
        ...(isEmailFeatureEnabled
          ? [AlertsControllerModule, RecoveryModule]
          : []),
        EstimationsModule,
        HealthModule,
        HooksModule,
        NotificationsModuleV2,
        MessagesModule,
        NotificationsModule,
        ...(isUsersFeatureEnabled
          ? [UsersModule, SpacesModule, MembersModule]
          : []),
        OwnersModule,
        RelayControllerModule,
        RootModule,
        SafeAppsModule,
        SafesModule,
        SafeShieldModule,
        TargetedMessagingModule,
        TransactionsModule,
        // common
        CacheModule,
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
