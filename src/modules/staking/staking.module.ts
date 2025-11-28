import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { IStakingApiManager } from '@/domain/interfaces/staking-api.manager.interface';
import { StakingApiManager } from '@/modules/staking/datasources/staking-api.manager';
import { StakingRepository } from '@/modules/staking/domain/staking.repository';
import { IStakingRepositoryWithRewardsFee } from '@/modules/staking/domain/staking.repository.interface';

@Module({
  imports: [CacheFirstDataSourceModule, ConfigApiModule],
  providers: [
    { provide: IStakingApiManager, useClass: StakingApiManager },
    HttpErrorFactory,
    {
      provide: IStakingRepositoryWithRewardsFee,
      useClass: StakingRepository,
    },
  ],
  exports: [IStakingApiManager, IStakingRepositoryWithRewardsFee],
})
export class StakingModule {}
