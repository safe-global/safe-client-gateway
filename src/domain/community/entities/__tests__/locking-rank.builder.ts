import { IBuilder, Builder } from '@/__tests__/builder';
import { LockingRank } from '@/domain/community/entities/locking-rank.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function lockingRankBuilder(): IBuilder<LockingRank> {
  return new Builder<LockingRank>()
    .with('holder', getAddress(faker.finance.ethereumAddress()))
    .with('position', faker.number.int())
    .with('lockedAmount', faker.string.numeric())
    .with('unlockedAmount', faker.string.numeric())
    .with('withdrawnAmount', faker.string.numeric());
}
