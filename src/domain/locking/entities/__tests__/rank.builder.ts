import { IBuilder, Builder } from '@/__tests__/builder';
import { Rank } from '@/domain/locking/entities/rank.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function rankBuilder(): IBuilder<Rank> {
  return new Builder<Rank>()
    .with('holder', getAddress(faker.finance.ethereumAddress()))
    .with('position', faker.string.numeric())
    .with('lockedAmount', faker.string.numeric())
    .with('unlockedAmount', faker.string.numeric())
    .with('withdrawnAmount', faker.string.numeric());
}
