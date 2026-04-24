// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { PricesProvider } from '@/modules/chains/domain/entities/prices-provider.entity';

export function pricesProviderBuilder(): IBuilder<PricesProvider> {
  return new Builder<PricesProvider>()
    .with('chainName', faker.company.name())
    .with('nativeCoin', faker.finance.currencyName());
}
