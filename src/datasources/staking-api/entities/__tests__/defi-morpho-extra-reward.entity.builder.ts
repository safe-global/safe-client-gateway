import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { DefiMorphoExtraReward } from '@/datasources/staking-api/entities/defi-morpho-extra-reward.entity';

export function defiMorphoExtraRewardBuilder(): IBuilder<DefiMorphoExtraReward> {
  return new Builder<DefiMorphoExtraReward>()
    .with('chain_id', faker.number.int())
    .with('asset', getAddress(faker.finance.ethereumAddress()))
    .with('claimable', faker.string.numeric())
    .with('claimable_next', faker.string.numeric());
}
