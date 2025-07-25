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
import { ChainsModule } from '@/routes/chains/chains.module';
import { BalancesModule } from '@/routes/balances/balances.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { ConfigurationModule } from '@/config/configuration.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { CollectiblesModule } from '@/routes/collectibles/collectibles.module';
import { CommunityModule } from '@/routes/community/community.module';
import { ContractsModule } from '@/routes/contracts/contracts.module';
import { DataDecodedModule } from '@/routes/data-decode/data-decoded.module';
import { DelegatesModule } from '@/routes/delegates/delegates.module';
import { HooksModule } from '@/routes/hooks/hooks.module';
import { SafeAppsModule } from '@/routes/safe-apps/safe-apps.module';
import { HealthModule } from '@/routes/health/health.module';
import { OwnersModule } from '@/routes/owners/owners.module';
import { AboutModule } from '@/routes/about/about.module';
import { TransactionsModule } from '@/routes/transactions/transactions.module';
import { SafesModule } from '@/routes/safes/safes.module';
import { NotificationsModule } from '@/routes/notifications/v1/notifications.module';
import { EstimationsModule } from '@/routes/estimations/estimations.module';
import { MessagesModule } from '@/routes/messages/messages.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { RouteLoggerInterceptor } from '@/routes/common/interceptors/route-logger.interceptor';
import { NotFoundLoggerMiddleware } from '@/middleware/not-found-logger.middleware';
import configuration from '@/config/entities/configuration';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { DataSourceErrorFilter } from '@/routes/common/filters/data-source-error.filter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { RootModule } from '@/routes/root/root.module';
import { AlertsControllerModule } from '@/routes/alerts/alerts.controller.module';
import { RecoveryModule } from '@/routes/recovery/recovery.module';
import { RelayControllerModule } from '@/routes/relay/relay.controller.module';
import { ZodErrorFilter } from '@/routes/common/filters/zod-error.filter';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';
import { AuthModule } from '@/routes/auth/auth.module';
import { DelegatesV2Module } from '@/routes/delegates/v2/delegates.v2.module';
import { AccountsModule } from '@/routes/accounts/accounts.module';
import { NotificationsModuleV2 } from '@/routes/notifications/v2/notifications.module';
import { TargetedMessagingModule } from '@/routes/targeted-messaging/targeted-messaging.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { postgresConfig } from '@/config/entities/postgres.config';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { UsersModule } from '@/routes/users/users.module';
import { SpacesModule } from '@/routes/spaces/spaces.module';
import { MembersModule } from '@/routes/spaces/members.module';
import { BullModule } from '@nestjs/bullmq';

@Module({})
export class AppModule implements NestModule {
  static register(configFactory = configuration): DynamicModule {
    const {
      auth: isAuthFeatureEnabled,
      accounts: isAccountsFeatureEnabled,
      users: isUsersFeatureEnabled,
      email: isEmailFeatureEnabled,
      delegatesV2: isDelegatesV2Enabled,
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
        ChainsModule,
        CollectiblesModule,
        CommunityModule,
        ContractsModule,
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
