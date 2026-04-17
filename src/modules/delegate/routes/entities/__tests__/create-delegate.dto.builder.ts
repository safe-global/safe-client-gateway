// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CreateDelegateDto } from '@/modules/delegate/routes/entities/create-delegate.dto.entity';

export function createDelegateDtoBuilder(): IBuilder<CreateDelegateDto> {
  return new Builder<CreateDelegateDto>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 32 }))
    .with('label', faker.string.hexadecimal({ length: 32 }));
}
