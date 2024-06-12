import { Builder, IBuilder } from '@/__tests__/builder';
import { CounterfactualBalancesProvider } from '@/domain/chains/entities/counterfactual-balances-provider.entity';
import { faker } from '@faker-js/faker';

export function counterfactualBalancesProviderBuilder(): IBuilder<CounterfactualBalancesProvider> {
  return new Builder<CounterfactualBalancesProvider>()
    .with('chainName', faker.company.name())
    .with('enabled', faker.datatype.boolean());
}
