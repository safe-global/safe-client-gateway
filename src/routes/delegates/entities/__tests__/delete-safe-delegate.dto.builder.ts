import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { DeleteSafeDelegateDto } from '@/routes/delegates/entities/delete-safe-delegate.dto.entity';
import { getAddress } from 'viem';

export function deleteSafeDelegateDtoBuilder(): IBuilder<DeleteSafeDelegateDto> {
  return new Builder<DeleteSafeDelegateDto>()
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 32 }));
}
