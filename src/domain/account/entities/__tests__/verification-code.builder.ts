import { Builder, IBuilder } from '@/__tests__/builder';
import { VerificationCode } from '@/domain/account/entities/account.entity';
import { faker } from '@faker-js/faker';

export function verificationCodeBuilder(): IBuilder<VerificationCode> {
  return new Builder<VerificationCode>()
    .with('code', faker.string.numeric({ length: 6 }))
    .with('generatedOn', new Date())
    .with('sentOn', null);
}
