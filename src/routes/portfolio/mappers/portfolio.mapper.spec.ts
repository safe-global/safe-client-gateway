import { faker } from '@faker-js/faker';
import {
  assetByProtocolBuilder,
  assetByProtocolChainsBuilder,
  assetByProtocolsBuilder,
  complexProtocolPositionBuilder,
  nestedProtocolPositionBuilder,
  portfolioBuilder,
  regularProtocolPositionBuilder,
} from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { PortfolioMapper } from '@/routes/portfolio/mappers/portfolio.mapper';
import { ProtocolPositionType } from '@/domain/portfolio/entities/portfolio.entity';

describe('PortfolioMapper', () => {
  const target = new PortfolioMapper();
  const chainKeys = Object.entries(PortfolioMapper.ChainKeys) as Array<
    [keyof typeof PortfolioMapper.ChainKeys, string]
  >;

  it('should throw for unknown chains', () => {
    const chainId = '0';
    const portfolio = portfolioBuilder().build();

    expect(() => {
      target.mapChainPortfolio({ chainId, portfolio });
    }).toThrow(`${chainId} is not supported!`);
  });

  it('should map regular positions', () => {
    const [key, chainId] = faker.helpers.arrayElement(chainKeys);
    const protocol = faker.string.sample();
    const protocolType = faker.helpers.arrayElement(ProtocolPositionType);

    const regularProtocolPosition = regularProtocolPositionBuilder().build();
    const protocolPositions = { [protocolType]: regularProtocolPosition };
    const assetByProtocolChains = assetByProtocolChainsBuilder()
      .with(key, {
        protocolPositions: protocolPositions,
      })
      .build();
    const assetByProtocol = assetByProtocolBuilder()
      .with('chains', assetByProtocolChains)
      .build();
    const assetByProtocols = assetByProtocolsBuilder()
      .with(protocol, assetByProtocol)
      .build();
    const portfolio = portfolioBuilder()
      .with('assetByProtocols', assetByProtocols)
      .build();

    const result = target.mapChainPortfolio({
      chainId,
      portfolio,
    });

    expect(result).toEqual({
      results: [
        {
          fiatBalance: assetByProtocol.value,
          name: assetByProtocol.name,
          logoUri: assetByProtocol.imgLarge,
          protocolPositions: [
            {
              type: 'REGULAR',
              name: regularProtocolPosition.name,
              assets: regularProtocolPosition.assets.map((asset) => {
                return {
                  type: 'GENERAL',
                  address: asset.contract,
                  decimals: asset.decimal,
                  logoUri: asset.imgSmall,
                  name: asset.name,
                  symbol: asset.symbol,
                  balance: asset.balance,
                  price: asset.price,
                  fiatBalance: asset.value,
                  trusted: false,
                };
              }),
              fiatBalance: regularProtocolPosition.totalValue,
            },
          ],
        },
      ],
      count: 1,
      next: null,
      previous: null,
    });
  });

  it('should map complex positions, with typed assets', () => {
    const [key, chainId] = faker.helpers.arrayElement(chainKeys);
    const protocol = faker.string.sample();
    const protocolType = faker.helpers.arrayElement(ProtocolPositionType);

    const nestedProtocolPosition = nestedProtocolPositionBuilder().build();
    const complexProtocolPosition = complexProtocolPositionBuilder()
      .with('protocolPositions', [nestedProtocolPosition])
      .build();
    const protocolPositions = { [protocolType]: complexProtocolPosition };
    const assetByProtocolChains = assetByProtocolChainsBuilder()
      .with(key, {
        protocolPositions: protocolPositions,
      })
      .build();
    const assetByProtocol = assetByProtocolBuilder()
      .with('chains', assetByProtocolChains)
      .build();
    const assetByProtocols = assetByProtocolsBuilder()
      .with(protocol, assetByProtocol)
      .build();
    const portfolio = portfolioBuilder()
      .with('assetByProtocols', assetByProtocols)
      .build();

    const result = target.mapChainPortfolio({
      chainId,
      portfolio,
    });

    expect(result).toEqual({
      results: [
        {
          fiatBalance: assetByProtocol.value,
          name: assetByProtocol.name,
          logoUri: assetByProtocol.imgLarge,
          protocolPositions: [
            {
              type: 'COMPLEX',
              name: complexProtocolPosition.name,
              positions: [
                {
                  name: nestedProtocolPosition.name,
                  fiatBalance: nestedProtocolPosition.value,
                  healthRate: nestedProtocolPosition.healthRate,
                  assets: [
                    ...nestedProtocolPosition.assets.map((asset) => {
                      return {
                        type: 'GENERAL',
                        address: asset.contract,
                        decimals: asset.decimal,
                        logoUri: asset.imgSmall,
                        name: asset.name,
                        symbol: asset.symbol,
                        balance: asset.balance,
                        price: asset.price,
                        fiatBalance: asset.value,
                        trusted: false,
                      };
                    }),
                    ...(nestedProtocolPosition.borrowAssets ?? []).map(
                      (asset) => {
                        return {
                          type: 'BORROW',
                          address: asset.contract,
                          decimals: asset.decimal,
                          logoUri: asset.imgSmall,
                          name: asset.name,
                          symbol: asset.symbol,
                          balance: asset.balance,
                          price: asset.price,
                          fiatBalance: asset.value,
                          trusted: false,
                        };
                      },
                    ),
                    ...(nestedProtocolPosition.dexAssets ?? []).map((asset) => {
                      return {
                        type: 'DEX',
                        address: asset.contract,
                        decimals: asset.decimal,
                        logoUri: asset.imgSmall,
                        name: asset.name,
                        symbol: asset.symbol,
                        balance: asset.balance,
                        price: asset.price,
                        fiatBalance: asset.value,
                        trusted: false,
                      };
                    }),
                    ...(nestedProtocolPosition.rewardAssets ?? []).map(
                      (asset) => {
                        return {
                          type: 'REWARDS',
                          address: asset.contract,
                          decimals: asset.decimal,
                          logoUri: asset.imgSmall,
                          name: asset.name,
                          symbol: asset.symbol,
                          balance: asset.balance,
                          price: asset.price,
                          fiatBalance: asset.value,
                          trusted: false,
                        };
                      },
                    ),
                    ...(nestedProtocolPosition.supplyAssets ?? []).map(
                      (asset) => {
                        return {
                          type: 'SUPPLY',
                          address: asset.contract,
                          decimals: asset.decimal,
                          logoUri: asset.imgSmall,
                          name: asset.name,
                          symbol: asset.symbol,
                          balance: asset.balance,
                          price: asset.price,
                          fiatBalance: asset.value,
                          trusted: false,
                        };
                      },
                    ),
                  ],
                },
              ],
              fiatBalance: complexProtocolPosition.totalValue,
            },
          ],
        },
      ],
      count: 1,
      next: null,
      previous: null,
    });
  });

  it.todo('should map both regular and complex positions');

  it.todo('should return no results if no positions are found');

  it.todo('should throw for unknown position types');
});
