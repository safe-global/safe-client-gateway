import { Module } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';
import { TransactionApiModule } from '../datasources/transaction-api/transaction-api.module';
import { ConfigApiModule } from '../datasources/config-api/config-api.module';
import { ExchangeModule } from '../datasources/exchange-api/exchange.module';

@Module({
  controllers: [BalancesController],
  providers: [BalancesService],
  imports: [TransactionApiModule, ExchangeModule, ConfigApiModule],
})
export class BalancesModule {}
