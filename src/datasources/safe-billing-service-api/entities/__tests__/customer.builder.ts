// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Customer } from '@/datasources/safe-billing-service-api/entities/customer.entity';

export function customerBuilder(): IBuilder<Customer> {
  return new Builder<Customer>()
    .with('id', faker.string.uuid())
    .with('upstreamCustomerId', faker.string.uuid())
    .with('customerGroup', faker.word.noun());
}
