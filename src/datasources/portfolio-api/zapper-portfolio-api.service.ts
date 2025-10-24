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
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import type {
  ZapperV2Token,
  ZapperV2App,
  ZapperResponse,
} from '@/datasources/portfolio-api/entities/zapper.entity';

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
    trusted?: boolean;
    fungibleIds?: Array<string>;
  }): Promise<Raw<Portfolio>> {
    try {
      const query = this._buildGraphQLQuery();
      const fiatCode = args.fiatCode.toUpperCase();

      const response = await this.networkService.post<{ data: ZapperResponse }>(
        {
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
        },
      );

      // GraphQL wraps response in { data: { ... } }
      const graphqlResponse = response.data as unknown as {
        data: ZapperResponse;
        errors?: Array<{ message: string }>;
      };

      if (graphqlResponse.errors && graphqlResponse.errors.length > 0) {
        throw new Error(`GraphQL Error: ${graphqlResponse.errors[0].message}`);
      }

      return this._buildPortfolio(graphqlResponse.data);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  private _buildGraphQLQuery(): string {
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
                    chainId
                  }
                  symbol
                  name
                  decimals
                  balance
                  balanceUSD
                  balanceInCurrency(currency: $priceCurrency)
                  price
                  imgUrlV2
                  verified
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
                    chainId
                  }
                  balanceUSD
                  balanceInCurrency(currency: $priceCurrency)
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
    const tokenBalances = this._buildTokenBalances(
      response.portfolioV2.tokenBalances.byToken.edges.map((edge) => edge.node),
    );

    const appBalances = this._buildAppBalances(
      response.portfolioV2.appBalances.byApp.edges.map((edge) => edge.node),
    );

    const totalBalanceFiat =
      response.portfolioV2.tokenBalances.totalBalanceUSD +
      response.portfolioV2.appBalances.totalBalanceUSD;
    const totalTokenBalanceFiat =
      response.portfolioV2.tokenBalances.totalBalanceUSD;
    const totalPositionsBalanceFiat =
      response.portfolioV2.appBalances.totalBalanceUSD;

    return rawify({
      totalBalanceFiat,
      totalTokenBalanceFiat,
      totalPositionsBalanceFiat,
      tokenBalances,
      positionBalances: appBalances,
      pnl: null,
    });
  }

  private _buildTokenBalances(
    tokens: Array<ZapperV2Token>,
  ): Array<TokenBalance> {
    return tokens
      .filter((token) => isAddress(token.tokenAddress))
      .map((token): TokenBalance => {
        const decimals = token.decimals ?? 18;

        return {
          tokenInfo: {
            address: getAddress(token.tokenAddress),
            decimals,
            symbol: token.symbol,
            name: token.name ?? token.symbol,
            logoUrl: token.imgUrlV2 ?? null,
            chainId: token.network.chainId.toString(),
            trusted: token.verified ?? false,
          },
          balance: token.balance.toString(),
          balanceFiat: token.balanceInCurrency ?? null,
          price: token.onchainMarketData?.price ?? null,
          priceChangePercentage1d:
            token.onchainMarketData?.priceChange24h ?? null,
        };
      });
  }

  private _buildAppBalances(apps: Array<ZapperV2App>): Array<AppBalance> {
    return apps.map((app): AppBalance => {
      const positions = this._buildAppPositions(app);
      const balanceFiat =
        app.balanceInCurrency !== undefined && app.balanceInCurrency !== null
          ? app.balanceInCurrency
          : app.balanceUSD;

      return {
        appInfo: {
          name: app.app.displayName,
          logoUrl: app.app.imgUrl,
          url: null,
        },
        balanceFiat,
        positions,
      };
    });
  }

  private _buildAppPositions(app: ZapperV2App): Array<AppPosition> {
    return app.positionBalances.edges
      .map((edge) => edge.node)
      .filter((token) => isAddress(token.address))
      .map((token): AppPosition => {
        return {
          key: `${app.app.slug}-${token.network}-${token.address}`,
          type: token.groupLabel,
          name: token.displayProps?.label ?? token.symbol,
          tokenInfo: {
            address: getAddress(token.address),
            decimals: token.decimals,
            symbol: token.symbol,
            name: token.symbol,
            logoUrl: null,
            chainId: app.network.chainId.toString(),
            trusted: true, // App positions are hand-selected by Zapper
          },
          balance: token.balance,
          balanceFiat: token.balanceUSD,
          priceChangePercentage1d: null, // Zapper doesn't provide 1d price change
        };
      });
  }
}
