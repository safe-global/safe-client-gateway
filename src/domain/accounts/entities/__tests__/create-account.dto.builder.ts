import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CreateAccountDto } from '@/domain/accounts/entities/create-account.dto.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function createAccountDtoBuilder(): IBuilder<CreateAccountDto> {
  return (
    new Builder<CreateAccountDto>()
      .with('address', getAddress(faker.finance.ethereumAddress()))
      // Note: regular expression is simplified because faker has limited support for regex.
      // https://fakerjs.dev/api/helpers#fromregexp
      .with('name', faker.helpers.fromRegExp(/[a-zA-Z0-9]{12,20}/i))
  );
}
