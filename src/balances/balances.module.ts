import { Module } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';
import { SafeTransactionModule } from '../services/safe-transaction/safe-transaction.module';

@Module({
  controllers: [BalancesController],
  providers: [BalancesService],
  imports: [SafeTransactionModule],
})
export class BalancesModule {}
