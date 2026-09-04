// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder, type IBuilder } from '@/__tests__/builder';
import type {
  CloudCosignerPolicy,
  SafeCloudCosignerPolicy,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';

export function cloudCosignerPolicyBuilder(): IBuilder<CloudCosignerPolicy> {
  return new Builder<CloudCosignerPolicy>()
    .with('valueThresholdUsd', faker.number.int({ min: 1_000, max: 1_000_000 }))
    .with('reviewUnknownContracts', faker.datatype.boolean())
    .with('instructions', faker.lorem.sentence());
}

export function safeCloudCosignerPolicyBuilder(): IBuilder<SafeCloudCosignerPolicy> {
  return new Builder<SafeCloudCosignerPolicy>()
    .with('id', faker.number.int())
    .with('createdAt', faker.date.recent())
    .with('updatedAt', faker.date.recent())
    .with('chainId', faker.string.numeric())
    .with('safeAddress', getAddress(faker.finance.ethereumAddress()))
    .with('valueThresholdUsd', faker.number.int({ min: 1_000, max: 1_000_000 }))
    .with('reviewUnknownContracts', faker.datatype.boolean())
    .with('instructions', faker.lorem.sentence());
}
