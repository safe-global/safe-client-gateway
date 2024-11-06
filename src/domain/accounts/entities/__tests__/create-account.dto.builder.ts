import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { accountNameBuilder } from '@/domain/accounts/entities/__tests__/account-name.builder';
import type { CreateAccountDto } from '@/domain/accounts/entities/create-account.dto.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function createAccountDtoBuilder(): IBuilder<CreateAccountDto> {
  return new Builder<CreateAccountDto>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('name', accountNameBuilder());
}
