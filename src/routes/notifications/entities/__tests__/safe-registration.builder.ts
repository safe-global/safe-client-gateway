import { faker } from '@faker-js/faker';
import { random, range } from 'lodash';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { SafeRegistration } from '../safe-registration.entity';

export function safeRegistrationBuilder(): IBuilder<SafeRegistration> {
  return Builder.new<SafeRegistration>()
    .with('chain_id', faker.random.numeric())
    .with(
      'safes',
      range(random(5)).map(() => faker.finance.ethereumAddress()),
    )
    .with(
      'signatures',
      range(random(5)).map(() => faker.datatype.hexadecimal(32)),
    );
}
