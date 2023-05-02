import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { v4 as uuidv4 } from 'uuid';

import { ChainsModule } from './routes/chains/chains.module';
import { BalancesModule } from './routes/balances/balances.module';
import { NetworkModule } from './datasources/network/network.module';
import { ConfigurationModule } from './config/configuration.module';
import { CacheModule } from './datasources/cache/cache.module';
import { DomainModule } from './domain.module';
import { CacheHooksModule } from './routes/cache-hooks/cache-hooks.module';
import { CollectiblesModule } from './routes/collectibles/collectibles.module';
import { ContractsModule } from './routes/contracts/contracts.module';
import { DataDecodedModule } from './routes/data-decode/data-decoded.module';
import { DelegatesModule } from './routes/delegates/delegates.module';
import { SafeAppsModule } from './routes/safe-apps/safe-apps.module';
import { HealthModule } from './routes/health/health.module';
import { OwnersModule } from './routes/owners/owners.module';
import { AboutModule } from './routes/about/about.module';
import { TransactionsModule } from './routes/transactions/transactions.module';
import { SafesModule } from './routes/safes/safes.module';
import { NotificationsModule } from './routes/notifications/notifications.module';
import { EstimationsModule } from './routes/estimations/estimations.module';
import { MessagesModule } from './routes/messages/messages.module';
import { ValidationModule } from './validation/validation.module';
import { FlushModule } from './routes/flush/flush.module';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';
import { NotFoundLoggerMiddleware } from './middleware/not-found-logger.middleware';
import { RequestScopedLoggingModule } from './routes/common/logging/logging.module';
import { RouteLoggerInterceptor } from './routes/common/interceptors/route-logger.interceptor';

@Module({
  imports: [
    // features
    AboutModule,
    BalancesModule,
    CacheHooksModule,
    ChainsModule,
    CollectiblesModule,
    ContractsModule,
    DataDecodedModule,
    DelegatesModule,
    EstimationsModule,
    FlushModule,
    HealthModule,
    MessagesModule,
    NotificationsModule,
    OwnersModule,
    SafeAppsModule,
    SafesModule,
    TransactionsModule,
    // common
    CacheModule,
    // Module for storing and reading from the async local storage
    ClsModule.forRoot({
      global: true,
      middleware: {
        generateId: true,
        idGenerator: () => uuidv4(),
      },
    }),
    ConfigurationModule,
    DomainModule,
    NetworkModule,
    RequestScopedLoggingModule,
    ValidationModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RouteLoggerInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      // The ClsMiddleware needs to be applied before the LoggerMiddleware
      .apply(ClsMiddleware, NotFoundLoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
