import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  ZerionApplicationMetadata,
  ZerionAttributes,
  ZerionBalance,
  ZerionBalances,
  ZerionChanges,
  ZerionFlags,
  ZerionFungibleInfo,
  ZerionImplementation,
  ZerionQuantity,
} from '@/modules/balances/datasources/entities/zerion-balance.entity';
import { getAddress } from 'viem';
import { PositionTypes } from '@/modules/positions/domain/entities/position-type.entity';

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

export function zerionApplicationMetadataBuilder(): IBuilder<ZerionApplicationMetadata> {
  return new Builder<ZerionApplicationMetadata>()
    .with('url', faker.image.url())
    .with('name', faker.string.sample())
    .with('icon', { url: faker.image.url() });
}

export function zerionChangesBuilder(): IBuilder<ZerionChanges> {
  return new Builder<ZerionChanges>()
    .with('percent_1d', faker.number.float())
    .with('absolute_1d', faker.number.float());
}

export function zerionAttributesBuilder(): IBuilder<ZerionAttributes> {
  return new Builder<ZerionAttributes>()
    .with('name', faker.string.sample())
    .with('quantity', zerionQuantityBuilder().build())
    .with('value', faker.number.float())
    .with('price', faker.number.float())
    .with('fungible_info', zerionFungibleInfoBuilder().build())
    .with('flags', zerionFlagsBuilder().build())
    .with('application_metadata', zerionApplicationMetadataBuilder().build())
    .with('protocol', faker.string.sample())
    .with(
      'changes',
      faker.datatype.boolean() ? zerionChangesBuilder().build() : null,
    )
    .with('position_type', faker.helpers.arrayElement(PositionTypes));
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
