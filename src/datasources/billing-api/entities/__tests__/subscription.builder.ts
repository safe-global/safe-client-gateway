// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import { subscriptionPlanBuilder } from '#/datasources/billing-api/entities/__tests__/plan.builder';
import type { Subscription } from '#/datasources/billing-api/entities/subscription.entity';
import { SubscriptionStatuses } from '#/datasources/billing-api/entities/subscription.entity';
import { toSecondsTimestamp } from '#/domain/common/utils/time';
import { WALLET_WEB_CUSTOMER_GROUP } from '#/modules/billing/domain/entities/webhook-event.entity';
import { CUSTOMER_GROUP_METADATA_KEY } from '#/modules/entitlements/domain/entitlements.constants';

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
    .with('currentPeriodStart', toSecondsTimestamp(faker.date.recent()))
    .with('currentPeriodEnd', toSecondsTimestamp(faker.date.soon()))
    .with('metadata', {
      [CUSTOMER_GROUP_METADATA_KEY]: WALLET_WEB_CUSTOMER_GROUP,
      [faker.word.noun()]: faker.word.sample(),
    })
    .with('hasPaymentMethod', faker.datatype.boolean());
}
