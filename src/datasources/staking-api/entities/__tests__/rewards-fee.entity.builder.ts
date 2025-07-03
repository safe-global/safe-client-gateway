import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { RewardsFee } from '@/datasources/staking-api/entities/rewards-fee.entity';
import { faker } from '@faker-js/faker';

export function rewardsFeeBuilder(): IBuilder<RewardsFee> {
  return new Builder<RewardsFee>().with('fee', faker.number.float());
}
