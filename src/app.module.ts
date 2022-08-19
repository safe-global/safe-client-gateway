import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { ChainsModule } from './chains/chains.module';
import { BalancesModule } from './balances/balances.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { NetworkModule } from './common/network/network.module';
import { ConfigurationModule } from './common/config/configuration.module';

@Module({
  imports: [
    // features
    BalancesModule,
    ChainsModule,
    // common
    NetworkModule,
    ConfigurationModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
