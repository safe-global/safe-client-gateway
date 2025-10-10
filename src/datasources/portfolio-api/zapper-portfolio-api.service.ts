import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { getAddress, isAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import type { TokenBalance } from '@/domain/portfolio/entities/token-balance.entity';
import type { AppBalance } from '@/domain/portfolio/entities/app-balance.entity';
import type { AppPosition } from '@/domain/portfolio/entities/app-position.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { getNumberString } from '@/domain/common/utils/utils';
import { rawify, type Raw } from '@/validation/entities/raw.entity';

interface ZapperToken {
  address: string;
  network: string;
  symbol: string;
  name?: string;
  decimals: number;
  price?: number;
  balance?: string;
  balanceUSD?: number;
  imgUrlV2?: string;
  onchainMarketData?: {
    priceChange24h?: number;
    price?: number;
  };
}

interface ZapperAppTokenBalance {
  address: string;
  network: string;
  symbol: string;
  name?: string;
  displayLabel?: string;
  decimals: number;
  balance: string;
  balanceUSD: number;
  category: string;
}

interface ZapperApp {
  appId: string;
  appName: string;
  appImage: string;
  network: string;
  balanceUSD: number;
  tokens: Array<ZapperAppTokenBalance>;
}

interface ZapperV2Token {
  tokenAddress: string;
  network: { name: string };
  symbol: string;
  name?: string;
  decimals: number | null;
  balance: number;
  balanceUSD: number;
  price?: number;
  imgUrlV2?: string;
  onchainMarketData?: {
    priceChange24h?: number;
    price?: number;
  };
}

interface ZapperV2App {
  app: {
    displayName: string;
    imgUrl: string;
    slug: string;
  };
  network: { name: string };
  balanceUSD: number;
  positionBalances: {
    edges: Array<{
      node: {
        address: string;
        network: string;
        symbol: string;
        name?: string;
        decimals: number;
        balance: string;
        balanceUSD: number;
        groupLabel: string;
        displayProps?: {
          label?: string;
        };
      };
    }>;
  };
}

interface ZapperResponse {
  portfolioV2: {
    tokenBalances: {
      totalBalanceUSD: number;
      byToken: {
        edges: Array<{ node: ZapperV2Token }>;
      };
    };
    appBalances: {
      totalBalanceUSD: number;
      byApp: {
        edges: Array<{ node: ZapperV2App }>;
      };
    };
  };
}

@Injectable()
export class ZapperPortfolioApi implements IPortfolioApi {
  private readonly apiKey: string;
  private readonly baseUri: string;

  constructor(
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.apiKey = this.configurationService.getOrThrow<string>(
      'portfolio.providers.zapper.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'portfolio.providers.zapper.baseUri',
    );
  }

  async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
  }): Promise<Raw<Portfolio>> {
    try {
      const query = this._buildGraphQLQuery(args.address, args.chainIds);
      const fiatCode = args.fiatCode.toUpperCase();

      const result = await this.networkService.post<{ data: ZapperResponse }>({
        url: `${this.baseUri}/graphql`,
        data: {
          query,
          variables: {
            addresses: [args.address],
            first: 100,
            priceCurrency: fiatCode,
          },
        },
        networkRequest: {
          headers: {
            'x-zapper-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      });

      // GraphQL wraps response in { data: { ... } }
      return this._buildPortfolio((result.data as any).data);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  private _buildGraphQLQuery(
    address: Address,
    chainIds?: Array<string>,
  ): string {
    return `
      query PortfolioV2($addresses: [Address!]!, $first: Int = 100, $priceCurrency: Currency) {
        portfolioV2(addresses: $addresses) {
          tokenBalances {
            totalBalanceUSD
            byToken(first: $first) {
              edges {
                node {
                  tokenAddress
                  network {
                    name
                  }
                  symbol
                  name
                  decimals
                  balance
                  balanceUSD
                  price
                  imgUrlV2
                  onchainMarketData {
                    priceChange24h
                    price(currency: $priceCurrency)
                  }
                }
              }
            }
          }
          appBalances {
            totalBalanceUSD
            byApp(first: $first) {
              edges {
                node {
                  app {
                    displayName
                    imgUrl
                    slug
                  }
                  network {
                    name
                  }
                  balanceUSD
                  positionBalances(first: 20) {
                    edges {
                      node {
                        ... on AppTokenPositionBalance {
                          address
                          network
                          symbol
                          decimals
                          balance
                          balanceUSD
                          groupLabel
                          displayProps {
                            label
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
  }

  private _buildPortfolio(response: ZapperResponse): Raw<Portfolio> {
    // Transform portfolioV2 tokens to old format
    const tokens = response.portfolioV2.tokenBalances.byToken.edges.map((edge) => {
      const decimals = edge.node.decimals ?? 18;

      return {
        address: edge.node.tokenAddress,
        network: edge.node.network.name,
        symbol: edge.node.symbol,
        name: edge.node.name,
        decimals,
        balance: edge.node.balance.toString(),
        balanceUSD: edge.node.balanceUSD,
        price: edge.node.price,
        imgUrlV2: edge.node.imgUrlV2,
        onchainMarketData: edge.node.onchainMarketData,
      };
    });

    const tokenBalances = this._buildTokenBalances(tokens);

    // Transform portfolioV2 apps to old format
    const apps = response.portfolioV2.appBalances.byApp.edges.map((edge) => ({
      appId: edge.node.app.slug,
      appName: edge.node.app.displayName,
      appImage: edge.node.app.imgUrl,
      network: edge.node.network.name,
      balanceUSD: edge.node.balanceUSD,
      tokens: edge.node.positionBalances.edges.map((pos) => ({
        address: pos.node.address,
        network: pos.node.network,
        symbol: pos.node.symbol,
        name: undefined,
        displayLabel: pos.node.displayProps?.label,
        decimals: pos.node.decimals,
        balance: pos.node.balance,
        balanceUSD: pos.node.balanceUSD,
        category: pos.node.groupLabel,
      })),
    }));

    const appBalances = this._buildAppBalances(apps);

    const totalBalanceFiat = getNumberString(
      response.portfolioV2.tokenBalances.totalBalanceUSD +
        response.portfolioV2.appBalances.totalBalanceUSD,
    );
    const totalTokenBalanceFiat = getNumberString(
      response.portfolioV2.tokenBalances.totalBalanceUSD,
    );
    const totalPositionsBalanceFiat = getNumberString(
      response.portfolioV2.appBalances.totalBalanceUSD,
    );

    return rawify({
      totalBalanceFiat,
      totalTokenBalanceFiat,
      totalPositionsBalanceFiat,
      tokenBalances,
      positionBalances: appBalances,
    });
  }

  private _buildTokenBalances(tokens: Array<ZapperToken>): Array<TokenBalance> {
    return tokens
      .filter((token) => isAddress(token.address))
      .map((token): TokenBalance => {
        const balanceFiat = token.onchainMarketData?.price !== undefined && token.balance
          ? getNumberString(parseFloat(token.balance) * token.onchainMarketData.price)
          : null;

        return {
          tokenInfo: {
            address: getAddress(token.address),
            decimals: token.decimals,
            symbol: token.symbol,
            name: token.name ?? token.symbol,
            logoUrl: token.imgUrlV2 ?? null,
            chainId: this._mapNetworkToChainId(token.network),
          },
          balance: token.balance ?? '0',
          balanceFiat,
          price: token.onchainMarketData?.price !== undefined
            ? getNumberString(token.onchainMarketData.price)
            : null,
          priceChangePercentage1d: token.onchainMarketData?.priceChange24h !== undefined
            ? getNumberString(token.onchainMarketData.priceChange24h)
            : null,
        };
      });
  }

  private _buildAppBalances(apps: Array<ZapperApp>): Array<AppBalance> {
    return apps.map((app): AppBalance => {
      const positions = this._buildAppPositions(app);
      const balanceFiat = getNumberString(app.balanceUSD);

      return {
        appInfo: {
          name: app.appName,
          logoUrl: app.appImage ?? null,
          url: null,
        },
        balanceFiat,
        positions,
      };
    });
  }

  private _buildAppPositions(app: ZapperApp): Array<AppPosition> {
    return app.tokens
      .filter((token) => isAddress(token.address))
      .map((token): AppPosition => {
        const balanceFiat = getNumberString(token.balanceUSD);

        return {
          key: `${app.appId}-${token.network}-${token.address}`,
          type: token.category,
          name: token.displayLabel ?? token.symbol,
          tokenInfo: {
            address: getAddress(token.address),
            decimals: token.decimals,
            symbol: token.symbol,
            name: token.name ?? token.symbol,
            logoUrl: null,
            chainId: this._mapNetworkToChainId(token.network),
          },
          balance: token.balance,
          balanceFiat,
          priceChangePercentage1d: null, // Zapper doesn't provide 1d price change
        };
      });
  }

  private _mapChainIdToNetwork(chainId: string): string {
    const mapping: Record<string, string> = {
      '1': 'ETHEREUM',
      '10': 'OPTIMISM',
      '56': 'BSC',
      '100': 'GNOSIS',
      '137': 'POLYGON',
      '250': 'FANTOM',
      '8453': 'BASE',
      '42161': 'ARBITRUM',
      '43114': 'AVALANCHE',
    };
    return mapping[chainId] ?? 'ETHEREUM';
  }

  private _mapNetworkToChainId(network: string): string {
    const mapping: Record<string, string> = {
      ETHEREUM: '1',
      OPTIMISM: '10',
      BSC: '56',
      GNOSIS: '100',
      POLYGON: '137',
      FANTOM: '250',
      BASE: '8453',
      ARBITRUM: '42161',
      AVALANCHE: '43114',
    };
    return mapping[network] ?? '1';
  }
}
