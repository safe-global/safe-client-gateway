import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { DeleteDelegateDto } from '@/routes/delegates/entities/delete-delegate.dto.entity';
import { getAddress } from 'viem';

export function deleteDelegateDtoBuilder(): IBuilder<DeleteDelegateDto> {
  return new Builder<DeleteDelegateDto>()
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 32 }));
}
