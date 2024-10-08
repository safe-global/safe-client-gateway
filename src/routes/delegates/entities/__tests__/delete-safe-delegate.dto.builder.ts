import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { DeleteSafeDelegateDto } from '@/routes/delegates/entities/delete-safe-delegate.dto.entity';
import { getAddress } from 'viem';

export function deleteSafeDelegateDtoBuilder(): IBuilder<DeleteSafeDelegateDto> {
  return new Builder<DeleteSafeDelegateDto>()
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with(
      'signature',
      faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
    );
}
