// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker/.';
import type { Hex } from 'viem';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';

export function counterfactualSafeBuilder(): IBuilder<CounterfactualSafe> {
  return new Builder<CounterfactualSafe>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('chainId', faker.string.numeric({ length: { min: 1, max: 6 } }))
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('factoryAddress', getAddress(faker.finance.ethereumAddress()))
    .with('masterCopy', getAddress(faker.finance.ethereumAddress()))
    .with('saltNonce', faker.string.numeric({ length: 13 }))
    .with('safeVersion', '1.4.1')
    .with('threshold', 1)
    .with('owners', [getAddress(faker.finance.ethereumAddress())])
    .with('fallbackHandler', getAddress(faker.finance.ethereumAddress()))
    .with('setupTo', getAddress(faker.finance.ethereumAddress()))
    .with(
      'setupData',
      `0x${faker.string.hexadecimal({ length: 64 }).slice(2)}` as Hex,
    )
    .with('paymentToken', null)
    .with('payment', null)
    .with('paymentReceiver', getAddress(faker.finance.ethereumAddress()))
    .with('createdAt', new Date())
    .with('updatedAt', new Date());
}
