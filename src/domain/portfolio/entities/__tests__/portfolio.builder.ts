import { faker } from '@faker-js/faker';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import {
  ProtocolChainKeys,
  ProtocolPositionType,
  type AssetByProtocol,
  type ComplexPosition,
  type Portfolio,
  type PortfolioAsset,
  type ProtocolPositions,
  type RegularPosition,
} from '@/domain/portfolio/entities/portfolio.entity';
import { getAddress } from 'viem';

export function portfolioBuilder(): IBuilder<Portfolio> {
  return new Builder<Portfolio>().with(
    'assetByProtocols',
    assetByProtocolsBuilder().build(),
  );
}

function assetByProtocolsBuilder(): IBuilder<Portfolio['assetByProtocols']> {
  const builder = new Builder<Portfolio['assetByProtocols']>();
  const protocols = faker.helpers.multiple(() => faker.string.sample(), {
    count: {
      min: 1,
      max: 5,
    },
  });
  for (const protocol of protocols) {
    builder.with(protocol, assetByProtocolBuilder().build());
  }
  return builder;
}

export function assetByProtocolBuilder(): IBuilder<AssetByProtocol> {
  return new Builder<AssetByProtocol>()
    .with('chains', assetByProtocolChainBuilder().build())
    .with('name', faker.string.sample())
    .with('imgLarge', faker.internet.url())
    .with('value', faker.string.numeric());
}

export function assetByProtocolChainBuilder(): IBuilder<
  AssetByProtocol['chains']
> {
  const builder = new Builder<AssetByProtocol['chains']>();
  const keys = faker.helpers.arrayElements(ProtocolChainKeys, {
    min: 1,
    max: 5,
  });
  for (const key of keys) {
    builder.with(key, {
      protocolPositions: protocolPositionsBuilder().build(),
    });
  }
  return builder;
}

export function protocolPositionsBuilder(): IBuilder<ProtocolPositions> {
  const builder = new Builder<ProtocolPositions>();
  const types = faker.helpers.arrayElements(ProtocolPositionType, {
    min: 1,
    max: 5,
  });
  for (const type of types) {
    builder.with(
      type,
      faker.datatype.boolean()
        ? regularPositionBuilder().build()
        : complexPositionBuilder().build(),
    );
  }
  return builder;
}

function getPortfolioAssets(): Array<PortfolioAsset> {
  return faker.helpers.multiple(() => portfolioAssetBuilder().build(), {
    count: {
      min: 1,
      max: 5,
    },
  });
}

export function regularPositionBuilder(): IBuilder<RegularPosition> {
  return new Builder<RegularPosition>()
    .with('name', faker.string.sample())
    .with('assets', getPortfolioAssets())
    .with('totalValue', faker.string.numeric());
}

export function complexPositionBuilder(): IBuilder<ComplexPosition> {
  return new Builder<ComplexPosition>()
    .with('name', faker.string.sample())
    .with(
      'protocolPositions',
      faker.helpers.multiple(() => complexPositionPositionBuilder().build(), {
        count: {
          min: 1,
          max: 5,
        },
      }),
    );
}

function getOptionalPortfolioAssets(): Array<PortfolioAsset> | undefined {
  return faker.datatype.boolean() ? getPortfolioAssets() : undefined;
}

export function complexPositionPositionBuilder(): IBuilder<
  ComplexPosition['protocolPositions'][number]
> {
  return new Builder<ComplexPosition['protocolPositions'][number]>()
    .with('name', faker.string.sample())
    .with('value', faker.string.numeric())
    .with('assets', getPortfolioAssets())
    .with('borrowAssets', getOptionalPortfolioAssets())
    .with('dexAssets', getOptionalPortfolioAssets())
    .with('rewardAssets', getOptionalPortfolioAssets())
    .with('supplyAssets', getOptionalPortfolioAssets());
}

export function portfolioAssetBuilder(): IBuilder<PortfolioAsset> {
  return new Builder<PortfolioAsset>()
    .with('balance', faker.string.numeric())
    .with('decimal', faker.number.int({ min: 1, max: 18 }))
    .with('name', faker.string.sample())
    .with('price', faker.string.numeric())
    .with('symbol', faker.string.sample())
    .with('value', faker.string.numeric())
    .with('contract', getAddress(faker.finance.ethereumAddress()))
    .with('imgSmall', faker.internet.url());
}
