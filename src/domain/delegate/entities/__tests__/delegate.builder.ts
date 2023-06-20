import { faker } from '@faker-js/faker';
import { Delegate } from '../delegate.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function delegateBuilder(): IBuilder<Delegate> {
  return Builder.new<Delegate>()
    .with('safe', faker.finance.ethereumAddress())
    .with('delegate', faker.finance.ethereumAddress())
    .with('delegator', faker.finance.ethereumAddress())
    .with('label', faker.word.sample());
}
