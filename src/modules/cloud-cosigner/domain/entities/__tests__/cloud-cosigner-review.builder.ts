// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import { Builder, type IBuilder } from '@/__tests__/builder';
import {
  type CloudCosignerReview,
  ReviewMode,
  ReviewStatus,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';

export function cloudCosignerReviewBuilder(): IBuilder<CloudCosignerReview> {
  return new Builder<CloudCosignerReview>()
    .with('id', faker.number.int())
    .with('createdAt', faker.date.recent())
    .with('updatedAt', faker.date.recent())
    .with('chainId', faker.string.numeric())
    .with('safeAddress', getAddress(faker.finance.ethereumAddress()))
    .with('safeTxHash', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('status', ReviewStatus.APPROVED)
    .with('mode', ReviewMode.RULES)
    .with('triggeredRules', [])
    .with('summary', faker.lorem.sentence())
    .with('riskFlags', [])
    .with('model', null)
    .with('signature', faker.string.hexadecimal({ length: 130 }) as Hex);
}
