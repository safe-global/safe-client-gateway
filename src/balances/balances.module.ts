import { Module } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';
import { TransactionServiceModule } from '../services/transaction-service/transaction-service.module';
import { ConfigServiceModule } from '../services/config-service/config-service.module';
import { ExchangeModule } from '../services/exchange/exchange.module';

@Module({
  controllers: [BalancesController],
  providers: [BalancesService],
  imports: [TransactionServiceModule, ExchangeModule, ConfigServiceModule],
})
export class BalancesModule {}
