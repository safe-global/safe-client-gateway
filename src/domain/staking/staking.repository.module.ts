import { StakingApiModule } from '@/datasources/staking-api/staking-api.module';
import { StakingRepository } from '@/domain/staking/staking.repository';
import { IStakingRepositoryWithRewardsFee } from '@/domain/staking/staking.repository.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [StakingApiModule],
  providers: [
    {
      provide: IStakingRepositoryWithRewardsFee,
      useClass: StakingRepository,
    },
  ],
  exports: [IStakingRepositoryWithRewardsFee],
})
export class StakingRepositoryModule {}
