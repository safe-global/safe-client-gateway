// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { SubscriptionStatuses } from '@/datasources/billing-api/entities/subscription.entity';
import type { SpaceSubscription } from '@/modules/entitlements/domain/entities/space-subscription.entity';

export function spaceSubscriptionBuilder(): IBuilder<SpaceSubscription> {
  return new Builder<SpaceSubscription>()
    .with('id', faker.number.int())
    .with('createdAt', faker.date.recent())
    .with('updatedAt', faker.date.recent())
    .with('upstreamSubscriptionId', faker.string.uuid())
    .with('status', faker.helpers.arrayElement(SubscriptionStatuses))
    .with('planId', faker.string.uuid())
    .with('planName', faker.commerce.productName())
    .with('currentPeriodStart', faker.date.recent())
    .with('currentPeriodEnd', faker.date.future())
    .with('lastEventAt', faker.date.recent());
}
