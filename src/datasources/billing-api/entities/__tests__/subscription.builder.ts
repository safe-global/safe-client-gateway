// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { subscriptionPlanBuilder } from '@/datasources/billing-api/entities/__tests__/plan.builder';
import type { Subscription } from '@/datasources/billing-api/entities/subscription.entity';
import { SubscriptionStatuses } from '@/datasources/billing-api/entities/subscription.entity';

export function subscriptionBuilder(): IBuilder<Subscription> {
  return new Builder<Subscription>()
    .with('id', faker.string.uuid())
    .with('customerId', faker.string.uuid())
    .with('upstreamCustomerId', faker.string.uuid())
    .with('plan', subscriptionPlanBuilder().build())
    .with('status', faker.helpers.arrayElement(SubscriptionStatuses))
    .with('createdAt', faker.number.int())
    .with('startAt', faker.number.int())
    .with('cancelledAt', null)
    .with('cancelAt', null)
    .with('validUntil', faker.number.int())
    .with('metadata', { [faker.word.noun()]: faker.word.sample() });
}
