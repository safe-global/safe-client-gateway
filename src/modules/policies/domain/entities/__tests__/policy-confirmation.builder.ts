// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import {
  type PolicyConfirmation,
  PolicyOperation,
} from '@/modules/policies/domain/entities/policy-confirmation.entity';

/** `transfer(address,uint256)` - the selector guarded by ERC20TransferPolicy. */
export const TRANSFER_SELECTOR = '0xa9059cbb';

export function hexBuilder(bytes: number): Hex {
  return `0x${faker.string.hexadecimal({ length: bytes * 2, prefix: '', casing: 'lower' })}`;
}

export function policyConfirmationBuilder(): IBuilder<PolicyConfirmation> {
  return new Builder<PolicyConfirmation>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('guard', getAddress(faker.finance.ethereumAddress()))
    .with('target', getAddress(faker.finance.ethereumAddress()))
    .with('selector', TRANSFER_SELECTOR)
    .with('operation', PolicyOperation.Call)
    .with('policy', getAddress(faker.finance.ethereumAddress()))
    .with('removed', false)
    .with('fallback', false)
    .with('data', hexBuilder(32))
    .with('dataDecoded', null)
    .with('transactionHash', hexBuilder(32))
    .with('blockNumber', faker.number.int({ min: 1, max: 1_000_000 }))
    .with('logIndex', faker.number.int({ min: 0, max: 10 }))
    .with('timestamp', faker.date.recent());
}
