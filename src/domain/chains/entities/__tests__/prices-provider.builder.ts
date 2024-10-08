import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { PricesProvider } from '@/domain/chains/entities/prices-provider.entity';
import { faker } from '@faker-js/faker';

export function pricesProviderBuilder(): IBuilder<PricesProvider> {
  return new Builder<PricesProvider>()
    .with('chainName', faker.company.name())
    .with('nativeCoin', faker.finance.currencyName());
}
