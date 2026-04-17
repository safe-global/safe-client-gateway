import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';

export function delegateBuilder(): IBuilder<Delegate> {
  return new Builder<Delegate>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('label', faker.word.sample());
}
