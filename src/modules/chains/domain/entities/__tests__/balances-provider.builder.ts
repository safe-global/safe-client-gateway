import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { BalancesProvider } from '@/modules/chains/domain/entities/balances-provider.entity';
import { faker } from '@faker-js/faker';

export function balancesProviderBuilder(): IBuilder<BalancesProvider> {
  return new Builder<BalancesProvider>()
    .with('chainName', faker.company.name())
    .with('enabled', faker.datatype.boolean());
}
