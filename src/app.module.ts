import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { ChainsModule } from './routes/chains/chains.module';
import { BalancesModule } from './routes/balances/balances.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { NetworkModule } from './datasources/network/network.module';
import { ConfigurationModule } from './common/config/configuration.module';
import { CacheModule } from './datasources/cache/cache.module';
import { DomainModule } from './domain.module';

@Module({
  imports: [
    // features
    BalancesModule,
    ChainsModule,
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
