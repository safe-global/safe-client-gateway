import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import {
  PositionFungibleInfo,
  PositionFungibleInfoImplementation,
  Position,
  PositionAttributes,
  PositionQuantity,
} from '../position.entity';

export function positionFungibleInfoImplementationBuilder(): IBuilder<PositionFungibleInfoImplementation> {
  return Builder.new<PositionFungibleInfoImplementation>()
    .with('chain_id', faker.string.sample())
    .with('address', faker.finance.ethereumAddress())
    .with('decimals', faker.number.int());
}

export function positionFungibleInfoBuilder(): IBuilder<PositionFungibleInfo> {
  return Builder.new<PositionFungibleInfo>()
    .with('name', faker.string.sample())
    .with('symbol', faker.finance.currencyCode())
    .with('description', faker.string.sample())
    .with('icon', { url: faker.internet.url() })
    .with('implementations', [
      positionFungibleInfoImplementationBuilder().build(),
      positionFungibleInfoImplementationBuilder().build(),
    ]);
}

export function positionQuantityBuilder(): IBuilder<PositionQuantity> {
  return Builder.new<PositionQuantity>()
    .with('int', faker.number.int().toString())
    .with('decimals', faker.number.int())
    .with('float', faker.number.float())
    .with('numeric', faker.number.float().toString());
}

export function positionAttributesBuilder(): IBuilder<PositionAttributes> {
  return Builder.new<PositionAttributes>()
    .with('name', faker.string.sample())
    .with('quantity', positionQuantityBuilder().build())
    .with('value', faker.number.float())
    .with('price', faker.number.float())
    .with('fungible_info', positionFungibleInfoBuilder().build());
}

export function positionBuilder(): IBuilder<Position> {
  return Builder.new<Position>()
    .with('type', 'positions')
    .with('id', faker.string.sample())
    .with('attributes', positionAttributesBuilder().build());
}
