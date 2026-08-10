// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { featureBuilder } from '@/modules/entitlements/domain/entities/__tests__/feature.builder';
import type { SubscriptionEntitlement } from '@/modules/entitlements/domain/entities/subscription-entitlement.entity';

export function subscriptionEntitlementBuilder(): IBuilder<SubscriptionEntitlement> {
  return new Builder<SubscriptionEntitlement>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('enabled', true)
    .with('quota', faker.number.int({ min: 1, max: 1_000 }))
    .with('value', null)
    .with('feature', featureBuilder().build())
    .with('createdAt', faker.date.recent())
    .with('updatedAt', faker.date.recent());
}
