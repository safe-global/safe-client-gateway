import { Builder, IBuilder } from '@/__tests__/builder';
import { CreateAccountDto } from '@/domain/accounts/entities/create-account.dto.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function createAccountDtoBuilder(): IBuilder<CreateAccountDto> {
  return new Builder<CreateAccountDto>().with(
    'address',
    getAddress(faker.finance.ethereumAddress()),
  );
}
