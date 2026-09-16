// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  PreviewLineItem,
  SubscriptionUpdatePreview,
  UpdateSubscriptionResult,
} from '@/datasources/billing-api/entities/subscription-update.entity';
import { toSecondsTimestamp } from '@/domain/common/utils/time';

function previewLineItemBuilder(): IBuilder<PreviewLineItem> {
  return new Builder<PreviewLineItem>()
    .with('description', faker.lorem.sentence())
    .with('amount', faker.number.int({ min: -10_000, max: 10_000 }))
    .with('currency', faker.finance.currencyCode().toLowerCase());
}

export function subscriptionUpdatePreviewBuilder(): IBuilder<SubscriptionUpdatePreview> {
  return new Builder<SubscriptionUpdatePreview>()
    .with('amountDue', faker.number.int({ min: 0, max: 100_000 }))
    .with('currency', faker.finance.currencyCode().toLowerCase())
    .with('nextBillingDate', toSecondsTimestamp(faker.date.future()))
    .with('lineItems', [
      previewLineItemBuilder().build(),
      previewLineItemBuilder().build(),
    ]);
}

export function updateSubscriptionResultBuilder(): IBuilder<UpdateSubscriptionResult> {
  return new Builder<UpdateSubscriptionResult>()
    .with('subscriptionId', faker.string.uuid())
    .with('success', true);
}
