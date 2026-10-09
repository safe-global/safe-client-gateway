// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder, type IBuilder } from '@/__tests__/builder';
import { policyConfigurationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import type { StoredPolicyConfiguration } from '@/modules/policies/domain/entities/stored-policy-configuration.entity';
import { configurationRoot } from '@/modules/policies/domain/utils/policy-configuration-root.utils';

/**
 * Configurations stored in CGW, with a root that is their hash.
 */
export function storedPolicyConfigurationBuilder(): IBuilder<StoredPolicyConfiguration> {
  const configurations: StoredPolicyConfiguration['configurations'] = [
    policyConfigurationBuilder().build(),
  ];

  return new Builder<StoredPolicyConfiguration>()
    .with('chainId', faker.string.numeric({ length: { min: 1, max: 6 } }))
    .with('safeAddress', getAddress(faker.finance.ethereumAddress()))
    .with('root', configurationRoot(configurations))
    .with('configurations', configurations)
    .with('createdAt', faker.date.recent());
}
