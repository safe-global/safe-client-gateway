import { Module } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';
import { TransactionApiModule } from '../datasources/transaction-api/transaction-api.module';
import { ConfigServiceModule } from '../datasources/config-service/config-service.module';
import { ExchangeModule } from '../datasources/exchange-api/exchange.module';

@Module({
  controllers: [BalancesController],
  providers: [BalancesService],
  imports: [TransactionApiModule, ExchangeModule, ConfigServiceModule],
})
export class BalancesModule {}
