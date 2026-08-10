// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { SubscriptionStatuses } from '@/datasources/billing-api/entities/subscription.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { SpaceSubscription } from '@/modules/entitlements/domain/entities/space-subscription.entity';

export function spaceSubscriptionBuilder(): IBuilder<SpaceSubscription> {
  return new Builder<SpaceSubscription>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('upstreamSubscriptionId', faker.string.uuid())
    .with('status', faker.helpers.arrayElement(SubscriptionStatuses))
    .with('planId', faker.lorem.slug())
    .with('planName', faker.commerce.productName())
    .with('currentPeriodStart', faker.date.recent())
    .with('currentPeriodEnd', faker.date.future())
    .with('createdAt', faker.date.recent())
    .with('updatedAt', faker.date.recent());
}
