// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder, type IBuilder } from '#/__tests__/builder';
import type { PolicyIndexerGuardEnforcedPolicy } from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';

export type RawIndexerGuardEnforcedPolicy = {
  chainId: number;
  safe: string;
  guard: string;
  target: string;
  selector: string;
  operation: string;
  kind: string;
  policy: string;
  state: unknown;
};

export function rawIndexerGuardEnforcedPolicyBuilder(): IBuilder<RawIndexerGuardEnforcedPolicy> {
  return (
    new Builder<RawIndexerGuardEnforcedPolicy>()
      .with('chainId', 11155111)
      .with('safe', getAddress(faker.finance.ethereumAddress()))
      .with('guard', getAddress(faker.finance.ethereumAddress()))
      .with('target', getAddress(faker.finance.ethereumAddress()))
      .with('selector', '0xa9059cbb')
      .with('operation', 'CALL')
      .with('kind', 'ERC20_TRANSFER')
      .with('policy', getAddress(faker.finance.ethereumAddress()))
      // An allowlist entry is an address plus how far its grant reaches.
      .with('state', {
        recipients: [
          {
            account: getAddress(faker.finance.ethereumAddress()),
            permission: 'ALWAYS',
          },
        ],
      })
  );
}

/**
 * A parsed guard binding, as a repository returns it.
 */
export function policyIndexerGuardEnforcedPolicyBuilder(): IBuilder<PolicyIndexerGuardEnforcedPolicy> {
  const raw = rawIndexerGuardEnforcedPolicyBuilder().build();

  return new Builder<PolicyIndexerGuardEnforcedPolicy>()
    .with('chainId', String(raw.chainId))
    .with('safe', getAddress(raw.safe))
    .with('guard', getAddress(raw.guard))
    .with('target', getAddress(raw.target))
    .with('selector', raw.selector as `0x${string}`)
    .with('operation', 'CALL')
    .with('kind', 'ERC20_TRANSFER')
    .with('policy', getAddress(raw.policy))
    .with('state', raw.state);
}
