import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { CreateDelegateDto } from '@/routes/delegates/entities/create-delegate.dto.entity';
import { getAddress } from 'viem';

export function createDelegateDtoBuilder(): IBuilder<CreateDelegateDto> {
  return new Builder<CreateDelegateDto>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 32 }))
    .with('label', faker.string.hexadecimal({ length: 32 }));
}
