// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  Plan,
  Product,
  SubscriptionPlan,
} from '@/datasources/billing-api/entities/plan.entity';
import {
  PlanBillingCycles,
  PlanCurrencies,
  PlanTypes,
} from '@/datasources/billing-api/entities/plan.entity';

export function productBuilder(): IBuilder<Product> {
  return new Builder<Product>()
    .with('id', faker.string.uuid())
    .with('active', faker.datatype.boolean())
    .with('description', faker.lorem.sentence())
    .with('marketingFeatures', [{ name: faker.commerce.productAdjective() }])
    .with('metadata', { customerGroup: faker.word.noun() })
    .with('name', faker.commerce.productName());
}

function withBasePlanFields<T extends Plan | SubscriptionPlan>(
  builder: Builder<T>,
): Builder<T> {
  return builder
    .with('id', faker.string.uuid())
    .with('name', faker.commerce.productName())
    .with('description', faker.lorem.sentence())
    .with('currentPrice', faker.number.float({ min: 0, max: 100 }))
    .with('originalPrice', faker.number.float({ min: 0, max: 100 }))
    .with('paymentMethod', 'fiat')
    .with('currency', faker.helpers.arrayElement(PlanCurrencies))
    .with(
      'features',
      faker.helpers.multiple(() => faker.commerce.productAdjective()),
    )
    .with('billingCycle', faker.helpers.arrayElement(PlanBillingCycles))
    .with('type', faker.helpers.arrayElement(PlanTypes));
}

export function planBuilder(): IBuilder<Plan> {
  return withBasePlanFields(new Builder<Plan>()).with(
    'product',
    productBuilder().build(),
  );
}

export function subscriptionPlanBuilder(): IBuilder<SubscriptionPlan> {
  return withBasePlanFields(new Builder<SubscriptionPlan>()).with(
    'product',
    faker.string.uuid(),
  );
}
