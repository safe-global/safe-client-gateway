import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CreateDelegateDto } from '@/routes/delegates/entities/create-delegate.dto.entity';
import { getAddress } from 'viem';

export function createDelegateDtoBuilder(): IBuilder<CreateDelegateDto> {
  return new Builder<CreateDelegateDto>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 32 }))
    .with('label', faker.string.hexadecimal({ length: 32 }));
}
