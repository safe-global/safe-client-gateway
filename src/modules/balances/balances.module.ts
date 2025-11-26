import { Module } from '@nestjs/common';
import { BalancesApiModule } from '@/modules/balances/datasources/balances-api.module';
import { BalancesRepositoryModule } from '@/modules/balances/domain/balances.repository.interface';
import { BalancesModule as BalancesRoutesModule } from '@/modules/balances/routes/balances.module';

@Module({
  imports: [BalancesApiModule, BalancesRepositoryModule, BalancesRoutesModule],
})
export class BalancesModule {}
