import { Module } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';
import { TransactionServiceModule } from '../services/transaction-service/transaction-service.module';

@Module({
  controllers: [BalancesController],
  providers: [BalancesService],
  imports: [TransactionServiceModule],
})
export class BalancesModule {}
