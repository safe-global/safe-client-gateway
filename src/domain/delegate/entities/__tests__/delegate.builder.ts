import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Delegate } from '@/domain/delegate/entities/delegate.entity';
import { getAddress } from 'viem';

export function delegateBuilder(): IBuilder<Delegate> {
  return new Builder<Delegate>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('label', faker.word.sample());
}
