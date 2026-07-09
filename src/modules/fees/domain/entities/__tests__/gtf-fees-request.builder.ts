// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { GtfFeesRequest } from '@/modules/fees/domain/entities/gtf-fees-request.entity';
import { Origin } from '@/modules/fees/domain/entities/origin.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

export function gtfFeesRequestBuilder(): IBuilder<GtfFeesRequest> {
  return new Builder<GtfFeesRequest>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', '0')
    .with(
      'data',
      faker.string.hexadecimal({
        casing: 'lower',
        prefix: '0x',
      }) as `0x${string}`,
    )
    .with('operation', Operation.CALL)
    .with('numberSignatures', faker.number.int({ min: 1, max: 10 }))
    .with('nonce', faker.number.int({ min: 0, max: 999 }).toString())
    .with('gasToken', getAddress(zeroAddress))
    .with('origin', faker.helpers.enumValue(Origin));
}
