import { StakingApiModule } from '@/datasources/staking-api/staking-api.module';
import { StakingRepository } from '@/domain/staking/staking.repository';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [StakingApiModule],
  providers: [
    {
      provide: IStakingRepository,
      useClass: StakingRepository,
    },
  ],
  exports: [IStakingRepository],
})
export class StakingRepositoryModule {}
