import { Builder, IBuilder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker';
import {
  Account,
  EmailAddress,
} from '@/domain/account/entities/account.entity';
import { getAddress } from 'viem';

export function accountBuilder(): IBuilder<Account> {
  return new Builder<Account>()
    .with('chainId', faker.string.numeric())
    .with('emailAddress', new EmailAddress(faker.internet.email()))
    .with('isVerified', faker.datatype.boolean())
    .with('safeAddress', getAddress(faker.finance.ethereumAddress()))
    .with('signer', getAddress(faker.finance.ethereumAddress()))
    .with('unsubscriptionToken', faker.string.uuid());
}
