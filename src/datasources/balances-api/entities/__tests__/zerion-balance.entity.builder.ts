import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import {
  ZerionAttributes,
  ZerionBalance,
  ZerionBalances,
  ZerionFlags,
  ZerionFungibleInfo,
  ZerionImplementation,
  ZerionQuantity,
} from '@/datasources/balances-api/entities/zerion-balance.entity';
import { getAddress } from 'viem';

export function zerionImplementationBuilder(): IBuilder<ZerionImplementation> {
  return new Builder<ZerionImplementation>()
    .with('chain_id', faker.string.sample())
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('decimals', faker.number.int());
}

export function zerionFungibleInfoBuilder(): IBuilder<ZerionFungibleInfo> {
  return new Builder<ZerionFungibleInfo>()
    .with('name', faker.string.sample())
    .with('symbol', faker.finance.currencyCode())
    .with('description', faker.string.sample())
    .with('icon', { url: faker.internet.url() })
    .with('implementations', [
      zerionImplementationBuilder().build(),
      zerionImplementationBuilder().build(),
    ]);
}

export function zerionQuantityBuilder(): IBuilder<ZerionQuantity> {
  return new Builder<ZerionQuantity>()
    .with('int', faker.string.numeric())
    .with('decimals', faker.number.int())
    .with('float', faker.number.float())
    .with('numeric', faker.number.float().toString());
}

export function zerionFlagsBuilder(): IBuilder<ZerionFlags> {
  return new Builder<ZerionFlags>().with(
    'displayable',
    faker.datatype.boolean(),
  );
}

export function zerionAttributesBuilder(): IBuilder<ZerionAttributes> {
  return new Builder<ZerionAttributes>()
    .with('name', faker.string.sample())
    .with('quantity', zerionQuantityBuilder().build())
    .with('value', faker.number.float())
    .with('price', faker.number.float())
    .with('fungible_info', zerionFungibleInfoBuilder().build())
    .with('flags', zerionFlagsBuilder().build());
}

export function zerionBalanceBuilder(): IBuilder<ZerionBalance> {
  return new Builder<ZerionBalance>()
    .with('type', 'positions')
    .with('id', faker.string.sample())
    .with('attributes', zerionAttributesBuilder().build());
}

export function zerionBalancesBuilder(): IBuilder<ZerionBalances> {
  return new Builder<ZerionBalances>().with(
    'data',
    Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () =>
      zerionBalanceBuilder().build(),
    ),
  );
}
