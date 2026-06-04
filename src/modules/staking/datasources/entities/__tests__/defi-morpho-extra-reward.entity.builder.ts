// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { DefiMorphoExtraReward } from '@/modules/staking/datasources/entities/defi-morpho-extra-reward.entity';

export function defiMorphoExtraRewardBuilder(): IBuilder<DefiMorphoExtraReward> {
  return new Builder<DefiMorphoExtraReward>()
    .with('chain_id', faker.number.int())
    .with('asset', getAddress(faker.finance.ethereumAddress()))
    .with('claimable', faker.string.numeric())
    .with('claimable_next', faker.string.numeric());
}
