// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder, type IBuilder } from '@/__tests__/builder';
import type { IndexerSafePolicy } from '@/modules/policies/domain/entities/indexer/safe-policy.entity';

export type RawIndexerSafePolicy = {
  chainId: number;
  safe: string;
  guard: string;
  target: string;
  selector: string;
  operation: string;
  kind: string;
  policy: string;
  active: boolean;
  isFallback: boolean;
  state: unknown;
};

export function rawIndexerSafePolicyBuilder(): IBuilder<RawIndexerSafePolicy> {
  return new Builder<RawIndexerSafePolicy>()
    .with('chainId', 11155111)
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('guard', getAddress(faker.finance.ethereumAddress()))
    .with('target', getAddress(faker.finance.ethereumAddress()))
    .with('selector', '0xa9059cbb')
    .with('operation', 'CALL')
    .with('kind', 'ERC20_TRANSFER')
    .with('policy', getAddress(faker.finance.ethereumAddress()))
    .with('active', true)
    .with('isFallback', false)
    .with('state', {
      recipients: [getAddress(faker.finance.ethereumAddress())],
    });
}

/**
 * A parsed guard binding, as a repository returns it.
 */
export function indexerSafePolicyBuilder(): IBuilder<IndexerSafePolicy> {
  const raw = rawIndexerSafePolicyBuilder().build();

  return new Builder<IndexerSafePolicy>()
    .with('chainId', String(raw.chainId))
    .with('safe', getAddress(raw.safe))
    .with('guard', getAddress(raw.guard))
    .with('target', getAddress(raw.target))
    .with('selector', raw.selector as `0x${string}`)
    .with('operation', 'CALL')
    .with('kind', 'ERC20_TRANSFER')
    .with('policy', getAddress(raw.policy))
    .with('active', true)
    .with('isFallback', false)
    .with('state', raw.state);
}
