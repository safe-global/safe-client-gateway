import { Builder, IBuilder } from '@/__tests__/builder';
import { BalancesProvider } from '@/domain/chains/entities/balances-provider.entity';
import { faker } from '@faker-js/faker';

export function balancesProviderBuilder(): IBuilder<BalancesProvider> {
  return new Builder<BalancesProvider>()
    .with('chainName', faker.company.name())
    .with('enabled', faker.datatype.boolean());
}
