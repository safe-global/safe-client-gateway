import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { ChainsModule } from './routes/chains/chains.module';
import { BalancesModule } from './routes/balances/balances.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
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
import { AboutModule } from './routes/about/about.module';

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
    HealthModule,
    SafeAppsModule,
    // common
    CacheModule,
    ConfigurationModule,
    DomainModule,
    NetworkModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
