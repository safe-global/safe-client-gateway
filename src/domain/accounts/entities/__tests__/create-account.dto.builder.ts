import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CreateAccountDto } from '@/domain/accounts/entities/create-account.dto.entity';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function createAccountDtoBuilder(): IBuilder<CreateAccountDto> {
  return new Builder<CreateAccountDto>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('name', nameBuilder());
}
