// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import { Builder, type IBuilder } from '@/__tests__/builder';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';

/** `transfer(address,uint256)`, the selector the allowlist policy accepts. */
const TRANSFER_SELECTOR = '0xa9059cbb';

/** A hex payload of `bytes` bytes. */
function hexBuilder(bytes: number): Hex {
  return `0x${faker.string.hexadecimal({
    length: bytes * 2,
    prefix: '',
    casing: 'lower',
  })}`;
}

export function policyConfigurationBuilder(): IBuilder<PolicyConfiguration> {
  return new Builder<PolicyConfiguration>()
    .with('target', getAddress(faker.finance.ethereumAddress()))
    .with('selector', TRANSFER_SELECTOR)
    .with('operation', 0)
    .with('policy', getAddress(faker.finance.ethereumAddress()))
    .with('data', hexBuilder(32));
}
