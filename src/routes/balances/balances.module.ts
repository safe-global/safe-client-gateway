import { Module } from '@nestjs/common';
import { BalancesController } from '@/routes/balances/balances.controller';
import { BalancesService } from '@/routes/balances/balances.service';
import { BalancesRepositoryModule } from '@/domain/balances/balances.repository.interface';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';

@Module({
  imports: [
    BalancesRepositoryModule,
    ChainsRepositoryModule,
    SafeRepositoryModule,
  ],
  controllers: [BalancesController],
  providers: [BalancesService],
})
export class BalancesModule {}
