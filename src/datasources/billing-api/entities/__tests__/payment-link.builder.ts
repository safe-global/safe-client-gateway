// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  PaymentLink,
  PaymentLinkLineItem,
} from '@/datasources/billing-api/entities/payment-link.entity';

function paymentLinkLineItemBuilder(): IBuilder<PaymentLinkLineItem> {
  return new Builder<PaymentLinkLineItem>()
    .with('price', {
      id: faker.string.uuid(),
      unitAmount: faker.number.int({ min: 100, max: 10_000 }),
      currency: faker.finance.currencyCode().toLowerCase(),
      recurring: { interval: 'month', intervalCount: 1 },
      product: faker.string.uuid(),
    })
    .with('quantity', 1);
}

// `trialPeriodDays` defaults to `null` — a paid link. The offer filter reads
// it, so a random trial length would make every spec that builds a link depend
// on which offer it happened to get.
export function paymentLinkBuilder(): IBuilder<PaymentLink> {
  return new Builder<PaymentLink>()
    .with('id', faker.string.uuid())
    .with('url', faker.internet.url())
    .with('active', faker.datatype.boolean())
    .with('metadata', {
      customerGroup: faker.word.noun(),
      upstreamCustomerId: faker.string.uuid(),
    })
    .with('customText', {})
    .with('afterCompletion', {})
    .with('lineItems', [paymentLinkLineItemBuilder().build()])
    .with('trialPeriodDays', null);
}

/** A trial link tagged with the `gracePeriod` metadata `isOfferedToSpace` filters on. */
export function trialPaymentLinkBuilder(
  gracePeriod: boolean,
): IBuilder<PaymentLink> {
  return paymentLinkBuilder()
    .with('trialPeriodDays', faker.number.int({ min: 1, max: 365 }))
    .with('metadata', { gracePeriod: String(gracePeriod) });
}

export function paymentLinkPricedAt(priceId: string): IBuilder<PaymentLink> {
  const lineItem = paymentLinkLineItemBuilder().build();

  return paymentLinkBuilder().with('lineItems', [
    { ...lineItem, price: { ...lineItem.price, id: priceId } },
  ]);
}
