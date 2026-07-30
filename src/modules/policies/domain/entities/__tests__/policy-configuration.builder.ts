// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import {
  hexBuilder,
  TRANSFER_SELECTOR,
} from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';

export function policyConfigurationBuilder(): IBuilder<PolicyConfiguration> {
  return new Builder<PolicyConfiguration>()
    .with('target', getAddress(faker.finance.ethereumAddress()))
    .with('selector', TRANSFER_SELECTOR)
    .with('operation', 0)
    .with('policy', getAddress(faker.finance.ethereumAddress()))
    .with('data', hexBuilder(32));
}
