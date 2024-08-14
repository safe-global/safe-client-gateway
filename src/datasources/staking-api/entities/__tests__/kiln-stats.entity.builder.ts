import { Builder, IBuilder } from '@/__tests__/builder';
import { KilnStats } from '@/datasources/staking-api/entities/kiln-stats.entity';
import { faker } from '@faker-js/faker';

function killStatsGrossApyBuilder(): IBuilder<KilnStats['gross_apy']> {
  return new Builder<KilnStats['gross_apy']>()
    .with('last_1d', faker.number.float())
    .with('last_7d', faker.number.float())
    .with('last_30d', faker.number.float());
}

export function kilnStatsBuilder(): IBuilder<KilnStats> {
  return new Builder<KilnStats>()
    .with('gross_apy', killStatsGrossApyBuilder().build())
    .with('updated_at', faker.date.recent());
}
