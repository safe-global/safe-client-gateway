import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { faker } from '@faker-js/faker';

export function networkStatsBuilder(): IBuilder<NetworkStats> {
  return new Builder<NetworkStats>()
    .with('eth_price_usd', faker.number.float())
    .with('nb_validators', faker.number.int())
    .with('network_gross_apy', faker.number.float())
    .with('supply_staked_percent', faker.number.float())
    .with('estimated_entry_time_seconds', faker.number.int())
    .with('estimated_exit_time_seconds', faker.number.int())
    .with('estimated_withdrawal_time_seconds', faker.number.int())
    .with('updated_at', faker.date.recent());
}
