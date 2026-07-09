// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Plan } from '@/datasources/billing-api/entities/plan.entity';

export function planBuilder(): IBuilder<Plan> {
  return new Builder<Plan>()
    .with('id', faker.string.uuid())
    .with('name', faker.commerce.productName())
    .with('description', faker.lorem.sentence())
    .with('currentPrice', faker.number.float({ min: 0, max: 100 }))
    .with('originalPrice', faker.number.float({ min: 0, max: 100 }))
    .with('paymentMethod', 'fiat')
    .with('currency', faker.helpers.arrayElement(['usd', 'eur']))
    .with(
      'features',
      faker.helpers.multiple(() => faker.commerce.productAdjective()),
    )
    .with('billingCycle', faker.helpers.arrayElement(['monthly', 'yearly']))
    .with(
      'type',
      faker.helpers.arrayElement(['standard', 'premium', 'enterprise']),
    );
}
