import { Module } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';
import { TransactionServiceModule } from '../datasources/transaction-service/transaction-service.module';
import { ConfigServiceModule } from '../datasources/config-service/config-service.module';
import { ExchangeModule } from '../datasources/exchange/exchange.module';

@Module({
  controllers: [BalancesController],
  providers: [BalancesService],
  imports: [TransactionServiceModule, ExchangeModule, ConfigServiceModule],
})
export class BalancesModule {}
