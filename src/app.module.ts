import { Module } from '@nestjs/common';
import { ChainsModule } from './chains/chains.module';
import { BalancesModule } from './balances/balances.module';

@Module({
  imports: [ChainsModule, BalancesModule],
})
export class AppModule {}
