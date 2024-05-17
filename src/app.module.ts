import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';
import { join } from 'path';
import { ChainsModule } from '@/routes/chains/chains.module';
import { BalancesModule } from '@/routes/balances/balances.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { ConfigurationModule } from '@/config/configuration.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { CacheHooksModule } from '@/routes/cache-hooks/cache-hooks.module';
import { CollectiblesModule } from '@/routes/collectibles/collectibles.module';
import { CommunityModule } from '@/routes/community/community.module';
import { ContractsModule } from '@/routes/contracts/contracts.module';
import { DataDecodedModule } from '@/routes/data-decode/data-decoded.module';
import { DelegatesModule } from '@/routes/delegates/delegates.module';
import { SafeAppsModule } from '@/routes/safe-apps/safe-apps.module';
import { HealthModule } from '@/routes/health/health.module';
import { OwnersModule } from '@/routes/owners/owners.module';
import { AboutModule } from '@/routes/about/about.module';
import { TransactionsModule } from '@/routes/transactions/transactions.module';
import { SafesModule } from '@/routes/safes/safes.module';
import { NotificationsModule } from '@/routes/notifications/notifications.module';
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
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { AlertsControllerModule } from '@/routes/alerts/alerts.controller.module';
import { RecoveryModule } from '@/routes/recovery/recovery.module';
import { RelayControllerModule } from '@/routes/relay/relay.controller.module';
import { SubscriptionControllerModule } from '@/routes/subscriptions/subscription.module';
import { LockingModule } from '@/routes/locking/locking.module';
import { ZodErrorFilter } from '@/routes/common/filters/zod-error.filter';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';
import { AuthModule } from '@/routes/auth/auth.module';
import { TransactionsViewControllerModule } from '@/routes/transactions/transactions-view.controller';
import { DelegatesV2Module } from '@/routes/delegates/v2/delegates.v2.module';

@Module({})
export class AppModule implements NestModule {
  // Important: values read via the config factory do not take the .env file
  // into account. The .env file loading is done by the ConfigurationModule
  // which is not available at this stage.
  static register(configFactory = configuration): DynamicModule {
    const {
      auth: isAuthFeatureEnabled,
      email: isEmailFeatureEnabled,
      confirmationView: isConfirmationViewEnabled,
      delegatesV2: isDelegatesV2Enabled,
    } = configFactory()['features'];

    return {
      module: AppModule,
      imports: [
        // features
        AboutModule,
        ...(isAuthFeatureEnabled ? [AuthModule] : []),
        BalancesModule,
        CacheHooksModule,
        ChainsModule,
        CollectiblesModule,
        CommunityModule,
        ContractsModule,
        DataDecodedModule,
        // TODO: delete/rename DelegatesModule when clients migration to v2 is completed.
        DelegatesModule,
        ...(isDelegatesV2Enabled ? [DelegatesV2Module] : []),
        ...(isEmailFeatureEnabled
          ? [
              AlertsControllerModule,
              EmailControllerModule,
              RecoveryModule,
              SubscriptionControllerModule,
            ]
          : []),
        EstimationsModule,
        HealthModule,
        LockingModule,
        MessagesModule,
        NotificationsModule,
        OwnersModule,
        RelayControllerModule,
        RootModule,
        SafeAppsModule,
        SafesModule,
        TransactionsModule,
        ...(isConfirmationViewEnabled
          ? [TransactionsViewControllerModule]
          : []),
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
        NetworkModule,
        RequestScopedLoggingModule,
        ServeStaticModule.forRoot({
          rootPath: join(__dirname, '..', 'assets'),
          // Excludes the paths under '/' (base url) from being served as static content
          // If we do not exclude these paths, the service will try to find the file and
          // return 500 for files that do not exist instead of a 404
          exclude: ['/(.*)'],
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
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
