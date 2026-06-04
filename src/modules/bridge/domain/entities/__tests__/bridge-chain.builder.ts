// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  BridgeChain,
  BridgeChainPage,
} from '@/modules/bridge/domain/entities/bridge-chain.entity';

export function bridgeChainBuilder(): IBuilder<BridgeChain> {
  return new Builder<BridgeChain>()
    .with('id', faker.string.numeric())
    .with('diamondAddress', getAddress(faker.finance.ethereumAddress()));
}

export function bridgeChainPageBuilder(): IBuilder<BridgeChainPage> {
  return new Builder<BridgeChainPage>().with(
    'chains',
    faker.helpers.multiple(() => bridgeChainBuilder().build(), {
      count: { min: 2, max: 5 },
    }),
  );
}
