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

@Module({
  imports: [BalancesModule, ChainsModule, NetworkModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
