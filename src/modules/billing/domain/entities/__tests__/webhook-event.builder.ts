// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { toSecondsTimestamp } from '@/domain/common/utils/time';
import type { WebhookEvent } from '@/modules/billing/domain/entities/webhook-event.entity';

type WebhookEventCustomer = NonNullable<
  NonNullable<WebhookEvent['data']>['customer']
>;

export function webhookEventCustomerBuilder(): IBuilder<WebhookEventCustomer> {
  return new Builder<WebhookEventCustomer>()
    .with('customerGroup', faker.word.sample())
    .with('upstreamCustomerId', faker.string.uuid())
    .with('customerId', faker.string.uuid());
}

export function webhookEventBuilder(): IBuilder<WebhookEvent> {
  return new Builder<WebhookEvent>()
    .with('id', faker.string.uuid())
    .with('type', 'customer.subscription.created')
    .with('created', faker.number.int())
    .with('data', {
      subscriptionId: faker.string.uuid(),
      status: 'active',
      planId: faker.string.alphanumeric(24),
      currentPeriodStart: toSecondsTimestamp(faker.date.recent()),
      currentPeriodEnd: toSecondsTimestamp(faker.date.soon()),
      metadata: null,
      customer: webhookEventCustomerBuilder().build(),
    });
}
