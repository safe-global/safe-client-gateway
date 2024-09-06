import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { IStakingApiManager } from '@/domain/interfaces/staking-api.manager.interface';
import { StakingApiManager } from '@/datasources/staking-api/staking-api.manager';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';

@Module({
  imports: [CacheFirstDataSourceModule, ConfigApiModule],
  providers: [
    { provide: IStakingApiManager, useClass: StakingApiManager },
    HttpErrorFactory,
  ],
  exports: [IStakingApiManager],
})
export class StakingApiModule {}
