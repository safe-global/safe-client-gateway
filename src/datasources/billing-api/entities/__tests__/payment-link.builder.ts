// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';

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
    .with('lineItems', [
      {
        price: {
          id: faker.string.uuid(),
          unitAmount: faker.number.int({ min: 100, max: 10_000 }),
          currency: faker.finance.currencyCode().toLowerCase(),
          recurring: { interval: 'month', intervalCount: 1 },
          product: faker.string.uuid(),
        },
        quantity: 1,
      },
    ]);
}
