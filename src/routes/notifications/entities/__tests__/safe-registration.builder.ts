import { faker } from '@faker-js/faker';
import { random, range } from 'lodash';
import { Builder, IBuilder } from '@/__tests__/builder';
import { SafeRegistration } from '@/routes/notifications/entities/safe-registration.entity';

export function safeRegistrationBuilder(): IBuilder<SafeRegistration> {
  return Builder.new<SafeRegistration>()
    .with('chainId', faker.string.numeric())
    .with(
      'safes',
      range(random(5)).map(() => faker.finance.ethereumAddress()),
    )
    .with(
      'signatures',
      range(random(5)).map(() => faker.string.hexadecimal({ length: 32 })),
    );
}
