import { Builder, IBuilder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker';
import { Email, EmailAddress } from '@/domain/email/entities/email.entity';

export function emailBuilder(): IBuilder<Email> {
  return new Builder<Email>()
    .with('chainId', faker.string.numeric())
    .with('emailAddress', new EmailAddress(faker.internet.email()))
    .with('isVerified', faker.datatype.boolean())
    .with('safeAddress', faker.finance.ethereumAddress())
    .with('account', faker.finance.ethereumAddress())
    .with('verificationCode', null)
    .with('verificationGeneratedOn', null)
    .with('verificationSentOn', null);
}
