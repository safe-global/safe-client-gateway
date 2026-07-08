// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CheckoutSession } from '@/datasources/safe-billing-service-api/entities/checkout-session.entity';

export function checkoutSessionBuilder(): IBuilder<CheckoutSession> {
  return new Builder<CheckoutSession>()
    .with('id', faker.string.uuid())
    .with('object', 'checkout.session')
    .with('amount_subtotal', faker.number.int({ min: 0, max: 10_000 }))
    .with('amount_total', faker.number.int({ min: 0, max: 10_000 }))
    .with('cancel_url', faker.internet.url())
    .with('client_reference_id', faker.string.uuid())
    .with('created', faker.number.int())
    .with('currency', faker.finance.currencyCode().toLowerCase())
    .with('customer', faker.string.uuid())
    .with('expires_at', faker.number.int())
    .with('metadata', {})
    .with('mode', 'payment')
    .with('payment_status', 'unpaid')
    .with('status', 'open')
    .with('success_url', faker.internet.url())
    .with('url', faker.internet.url())
    .with('subscription', faker.string.uuid())
    .with('invoice', faker.string.uuid());
}
