import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

import { Builder } from '@/__tests__/builder';
import { DefiVaultStatsChains } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import type { IBuilder } from '@/__tests__/builder';
import type { DefiVaultStake } from '@/datasources/staking-api/entities/defi-vault-stake.entity';

export function defiVaultStakeBuilder(): IBuilder<DefiVaultStake> {
  return new Builder<DefiVaultStake>()
    .with('vault_id', faker.string.uuid())
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('current_balance', faker.number.int({ min: 0, max: 100 }).toString())
    .with('shares_balance', faker.number.int({ min: 0, max: 100 }).toString())
    .with('total_rewards', faker.number.int({ min: 0, max: 100 }).toString())
    .with('current_rewards', faker.number.int({ min: 0, max: 100 }).toString())
    .with(
      'total_deposited_amount',
      faker.number.int({ min: 0, max: 100 }).toString(),
    )
    .with(
      'total_withdrawn_amount',
      faker.number.int({ min: 0, max: 100 }).toString(),
    )
    .with('vault', getAddress(faker.finance.ethereumAddress()))
    .with('chain', faker.helpers.arrayElement(DefiVaultStatsChains))
    .with('chain_id', faker.number.int({ min: 0, max: 100 }))
    .with('updated_at_block', faker.number.int({ min: 0, max: 100 }));
}
