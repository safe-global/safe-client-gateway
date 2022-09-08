import { Module } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';

@Module({
  controllers: [BalancesController],
  providers: [BalancesService],
})
export class BalancesModule {}
