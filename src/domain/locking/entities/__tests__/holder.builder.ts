import { Builder, IBuilder } from '@/__tests__/builder';
import { Holder } from '@/domain/locking/entities/holder.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function holderBuilder(): IBuilder<Holder> {
  return new Builder<Holder>()
    .with('holder', getAddress(faker.finance.ethereumAddress()))
    .with('position', faker.number.int())
    .with('boost', faker.string.numeric())
    .with('points', faker.string.numeric())
    .with('boostedPoints', faker.string.numeric());
}
