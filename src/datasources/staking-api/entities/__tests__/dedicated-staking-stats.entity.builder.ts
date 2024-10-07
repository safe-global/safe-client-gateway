import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import { faker } from '@faker-js/faker';

export function dedicatedStakingStatsGrossApyBuilder(): IBuilder<
  DedicatedStakingStats['gross_apy']
> {
  return new Builder<DedicatedStakingStats['gross_apy']>()
    .with('last_1d', faker.number.float())
    .with('last_7d', faker.number.float())
    .with('last_30d', faker.number.float());
}

export function dedicatedStakingStatsBuilder(): IBuilder<DedicatedStakingStats> {
  return new Builder<DedicatedStakingStats>()
    .with('gross_apy', dedicatedStakingStatsGrossApyBuilder().build())
    .with('updated_at', faker.date.recent());
}
