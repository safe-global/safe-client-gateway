// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { SubscriptionStatuses } from '@/datasources/billing-api/entities/subscription.entity';
import type {
  MaterializedSubscription,
  ParsedEntitlement,
} from '@/modules/entitlements/domain/entities/materialized-subscription.entity';

export function parsedEntitlementBuilder(): IBuilder<ParsedEntitlement> {
  return new Builder<ParsedEntitlement>()
    .with('featureKey', faker.lorem.slug())
    .with('enabled', true)
    .with('quota', faker.number.int({ min: 1, max: 1_000 }))
    .with('value', null);
}

export function materializedSubscriptionBuilder(): IBuilder<MaterializedSubscription> {
  return new Builder<MaterializedSubscription>()
    .with('upstreamSubscriptionId', faker.string.uuid())
    .with('status', faker.helpers.arrayElement(SubscriptionStatuses))
    .with('planId', faker.lorem.slug())
    .with('planName', faker.commerce.productName())
    .with('currentPeriodStart', faker.date.recent())
    .with('currentPeriodEnd', faker.date.future())
    .with('entitlements', []);
}
