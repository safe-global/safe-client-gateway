import { Module } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';
import { TransactionApiModule } from '../datasources/transaction-api/transaction-api.module';
import { ConfigApiModule } from '../datasources/config-api/config-api.module';
import { ExchangeApiModule } from '../datasources/exchange-api/exchange-api.module';

@Module({
  controllers: [BalancesController],
  providers: [BalancesService],
  imports: [TransactionApiModule, ExchangeApiModule, ConfigApiModule],
})
export class BalancesModule {}
