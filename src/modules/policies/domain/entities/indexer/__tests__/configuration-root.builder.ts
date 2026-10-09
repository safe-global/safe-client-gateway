// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, keccak256, toHex } from 'viem';
import { Builder, type IBuilder } from '@/__tests__/builder';
import type { PolicyIndexerConfigurationRoot } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';

export type RawIndexerConfigurationRoot = {
  chainId: number;
  safe: string;
  guard: string;
  root: string;
  /** `numeric` columns serialise as decimal strings. */
  readyAt: string;
  status: string;
};

/**
 * A configuration root as the indexer serves it. Pending by default.
 */
export function rawIndexerConfigurationRootBuilder(): IBuilder<RawIndexerConfigurationRoot> {
  return new Builder<RawIndexerConfigurationRoot>()
    .with('chainId', 11155111)
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('guard', getAddress(faker.finance.ethereumAddress()))
    .with('root', keccak256(toHex(faker.string.alphanumeric(32))))
    .with('readyAt', String(Math.floor(faker.date.future().getTime() / 1_000)))
    .with('status', 'PENDING');
}

/**
 * A parsed configuration root, as a repository returns it. Pending by default.
 */
export function policyIndexerConfigurationRootBuilder(): IBuilder<PolicyIndexerConfigurationRoot> {
  return new Builder<PolicyIndexerConfigurationRoot>()
    .with('chainId', faker.string.numeric({ length: { min: 1, max: 6 } }))
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('guard', getAddress(faker.finance.ethereumAddress()))
    .with('root', keccak256(toHex(faker.string.alphanumeric(32))))
    .with('readyAt', Math.floor(faker.date.future().getTime() / 1_000))
    .with('status', 'PENDING');
}
