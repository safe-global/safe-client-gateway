import { Module } from '@nestjs/common';
import { BalancesController } from '@/modules/balances/routes/balances.controller';
import { BalancesService } from '@/modules/balances/routes/balances.service';
import { BalancesRepositoryModule } from '@/modules/balances/domain/balances.repository.interface';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { ChainsRepositoryModule } from '@/modules/chains/domain/chains.repository.interface';

@Module({
  imports: [
    BalancesRepositoryModule,
    ChainsRepositoryModule,
    SafeRepositoryModule,
  ],
  controllers: [BalancesController],
  providers: [BalancesService],
  exports: [BalancesService],
})
export class BalancesModule {}
