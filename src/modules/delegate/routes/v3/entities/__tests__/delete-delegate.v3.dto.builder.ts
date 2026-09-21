// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { DeleteDelegateV3Dto } from '@/modules/delegate/routes/v3/entities/delete-delegate.v3.dto.entity';

export function deleteDelegateV3DtoBuilder(): IBuilder<DeleteDelegateV3Dto> {
  return new Builder<DeleteDelegateV3Dto>()
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 32 }) as Address);
}
