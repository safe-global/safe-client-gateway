import { Module } from '@nestjs/common';
import { BalancesController } from '@/routes/balances/balances.controller';
import { BalancesService } from '@/routes/balances/balances.service';

@Module({
  controllers: [BalancesController],
  providers: [BalancesService],
})
export class BalancesModule {}
