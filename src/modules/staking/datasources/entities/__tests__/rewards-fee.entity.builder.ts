// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { RewardsFee } from '@/modules/staking/datasources/entities/rewards-fee.entity';

export function rewardsFeeBuilder(): IBuilder<RewardsFee> {
  return new Builder<RewardsFee>().with('fee', faker.number.float());
}
