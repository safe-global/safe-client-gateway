import { StakingApiModule } from '@/modules/staking/datasources/staking-api.module';
import { StakingRepository } from '@/modules/staking/domain/staking.repository';
import { IStakingRepositoryWithRewardsFee } from '@/modules/staking/domain/staking.repository.interface';
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
