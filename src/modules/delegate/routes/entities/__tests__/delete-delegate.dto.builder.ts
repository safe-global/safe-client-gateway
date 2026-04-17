import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { DeleteDelegateDto } from '@/modules/delegate/routes/entities/delete-delegate.dto.entity';

export function deleteDelegateDtoBuilder(): IBuilder<DeleteDelegateDto> {
  return new Builder<DeleteDelegateDto>()
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 32 }));
}
