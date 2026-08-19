// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { UpdateDelegateV3Dto } from '@/modules/delegate/routes/v3/entities/update-delegate.v3.dto.entity';

export function updateDelegateV3DtoBuilder(): IBuilder<UpdateDelegateV3Dto> {
  return new Builder<UpdateDelegateV3Dto>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 32 }))
    .with('label', faker.string.hexadecimal({ length: 32 }));
}
