import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { getAddress, hexToNumber, isAddress } from 'viem';
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
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import type { ZerionBalance } from '@/datasources/balances-api/entities/zerion-balance.entity';
import { ZerionBalancesSchema } from '@/datasources/balances-api/entities/zerion-balance.entity';
import { ZerionChainsSchema } from '@/datasources/balances-api/entities/zerion-chain.entity';
import { ZodError } from 'zod';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';

@Injectable()
export class ZerionPortfolioApi implements IPortfolioApi {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly fiatCodes: Array<string>;
  private readonly chainsCacheTtlSeconds = 86400;

  constructor(
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
    this.fiatCodes = this.configurationService
      .getOrThrow<Array<string>>('balances.providers.zerion.currencies')
      .map((currency) => currency.toUpperCase());
  }

  async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
  }): Promise<Raw<Portfolio>> {
    if (!this.apiKey) {
      throw new DataSourceError(
        'Zerion API key is not configured. Set ZERION_API_KEY environment variable.',
        503,
      );
    }

    if (!this.fiatCodes.includes(args.fiatCode.toUpperCase())) {
      throw new DataSourceError(
        `Unsupported currency code: ${args.fiatCode}`,
        400,
      );
    }

    const positions = await this._fetchPositions(args);
    return await this._buildPortfolio(positions);
  }

  private async _fetchPositions(args: {
    address: Address;
    fiatCode: string;
    trusted?: boolean;
  }): Promise<Array<ZerionBalance>> {
    try {
      const url = `${this.baseUri}/v1/wallets/${args.address}/positions`;
      const params: Record<string, string> = {
        currency: args.fiatCode.toLowerCase(),
        sort: 'value',
        'filter[positions]': 'no_filter',
      };

      if (args.trusted) {
        params['filter[trash]'] = 'only_non_trash';
      }

      const networkRequest = {
        headers: { Authorization: `Basic ${this.apiKey}` },
        params,
      };

      const response = await this.networkService
        .get({
          url,
          networkRequest,
        })
        .then(({ data }) => ZerionBalancesSchema.parse(data));

      return response.data;
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * Transforms Zerion balance positions into the portfolio entity structure.
   * Filters out non-displayable and trash positions, then separates wallet positions from app positions.
   */
  private async _buildPortfolio(
    positions: Array<ZerionBalance>,
  ): Promise<Raw<Portfolio>> {
    const displayablePositions = positions.filter(
      (p) => p.attributes.flags.displayable && !p.attributes.flags.is_trash,
    );

    const walletPositions = displayablePositions.filter(
      (p) => p.attributes.position_type === 'wallet',
    );
    const appPositions = displayablePositions.filter(
      (p) => p.attributes.position_type !== 'wallet',
    );

    const [tokenBalances, appBalances] = await Promise.all([
      this._buildTokenBalances(walletPositions),
      this._buildAppBalances(appPositions),
    ]);

    const totalBalanceFiat = this._calculateTotalBalance(displayablePositions);
    const totalTokenBalanceFiat = this._calculateTotalBalance(walletPositions);
    const totalPositionsBalanceFiat = this._calculateTotalBalance(appPositions);

    return rawify({
      totalBalanceFiat,
      totalTokenBalanceFiat,
      totalPositionsBalanceFiat,
      tokenBalances,
      positionBalances: appBalances,
    });
  }

  /**
   * Converts Zerion wallet positions into TokenBalance entities.
   * Maps Zerion's network identifiers to chain IDs and extracts token information.
   * Filters out positions with missing or invalid data.
   */
  private async _buildTokenBalances(
    positions: Array<ZerionBalance>,
  ): Promise<Array<TokenBalance>> {
    const tokenBalances = await Promise.all(
      positions.map(async (position): Promise<TokenBalance | null> => {
        const networkName = position.relationships?.chain?.data?.id;
        if (!networkName) return null;

        const chainId = await this._mapNetworkToChainId(networkName);

        const impl = position.attributes.fungible_info.implementations.find(
          (i) => i.chain_id === networkName,
        );
        if (!impl) return null;

        if (impl.address !== null && !isAddress(impl.address)) {
          return null;
        }

        const address = impl.address ? getAddress(impl.address) : null;

        return {
          tokenInfo: {
            address,
            decimals: impl.decimals,
            symbol:
              position.attributes.fungible_info.symbol ??
              position.attributes.name,
            name:
              position.attributes.fungible_info.name ??
              position.attributes.name,
            logoUri: position.attributes.fungible_info.icon?.url ?? '',
            chainId,
            trusted: position.attributes.fungible_info.flags?.verified ?? false,
            type:
              address === null ||
              address === '0x0000000000000000000000000000000000000000'
                ? ('NATIVE_TOKEN' as const)
                : ('ERC20' as const),
          },
          balance: position.attributes.quantity.numeric,
          balanceFiat: position.attributes.value ?? null,
          price: position.attributes.price ?? null,
          priceChangePercentage1d:
            position.attributes.changes?.percent_1d ?? null,
        };
      }),
    );

    return tokenBalances.filter(
      (token): token is TokenBalance => token !== null,
    );
  }

  /**
   * Converts Zerion app positions into AppBalance entities.
   * Groups positions by application name and aggregates their balances.
   */
  private async _buildAppBalances(
    positions: Array<ZerionBalance>,
  ): Promise<Array<AppBalance>> {
    const grouped = new Map<string, Array<ZerionBalance>>();

    for (const position of positions) {
      const appName =
        position.attributes.application_metadata?.name ??
        position.attributes.protocol ??
        'Unknown';
      if (!grouped.has(appName)) {
        grouped.set(appName, []);
      }
      grouped.get(appName)!.push(position);
    }

    return Promise.all(
      Array.from(grouped.entries()).map(
        async ([appName, appPositions]): Promise<AppBalance> => {
          const appMetadata = appPositions[0].attributes.application_metadata;

          return {
            appInfo: {
              name: appName,
              logoUrl: appMetadata?.icon?.url ?? null,
              url: appMetadata?.url ?? null,
            },
            balanceFiat: this._calculatePositionsBalance(appPositions),
            positions: await this._buildAppPositions(appPositions),
          };
        },
      ),
    );
  }

  /**
   * Converts Zerion positions into AppPosition entities.
   * Similar to token balances but includes position-specific fields like key and type.
   */
  private async _buildAppPositions(
    positions: Array<ZerionBalance>,
  ): Promise<Array<AppPosition>> {
    const appPositions = await Promise.all(
      positions.map(async (position): Promise<AppPosition | null> => {
        const networkName = position.relationships?.chain?.data?.id;
        if (!networkName) return null;

        const chainId = await this._mapNetworkToChainId(networkName);

        const impl = position.attributes.fungible_info.implementations.find(
          (i) => i.chain_id === networkName,
        );
        if (!impl) return null;

        if (impl.address !== null && !isAddress(impl.address)) {
          return null;
        }

        const address = impl.address ? getAddress(impl.address) : null;

        return {
          key: position.id,
          type: position.attributes.position_type,
          name: position.attributes.name,
          tokenInfo: {
            address,
            decimals: impl.decimals,
            symbol:
              position.attributes.fungible_info.symbol ??
              position.attributes.name,
            name:
              position.attributes.fungible_info.name ??
              position.attributes.name,
            logoUri: position.attributes.fungible_info.icon?.url ?? '',
            chainId,
            trusted: position.attributes.fungible_info.flags?.verified ?? false,
            type: 'ERC20' as const,
          },
          balance: position.attributes.quantity.numeric,
          balanceFiat: position.attributes.value ?? null,
          priceChangePercentage1d:
            position.attributes.changes?.percent_1d ?? null,
        };
      }),
    );

    return appPositions.filter((pos): pos is AppPosition => pos !== null);
  }

  private _calculateTotalBalance(positions: Array<ZerionBalance>): number {
    return positions.reduce((sum, position) => {
      return sum + (position.attributes.value ?? 0);
    }, 0);
  }

  private _calculatePositionsBalance(positions: Array<ZerionBalance>): number {
    return positions.reduce((sum, position) => {
      return sum + (position.attributes.value ?? 0);
    }, 0);
  }

  private async _getCachedChainMapping(): Promise<Record<
    string,
    string
  > | null> {
    const cacheDir = new CacheRouter().getZerionChainsCacheDir();
    const cached = await this.cacheService.hGet(cacheDir);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  }

  private async _fetchAndCacheChainMapping(): Promise<Record<string, string>> {
    const url = `${this.baseUri}/v1/chains`;
    const networkRequest = {
      headers: { Authorization: `Basic ${this.apiKey}` },
    };

    const response = await this.networkService
      .get({ url, networkRequest })
      .then(({ data }) => ZerionChainsSchema.parse(data));

    const mapping: Record<string, string> = {};
    for (const chain of response.data) {
      const networkName = chain.id;
      const hexChainId = chain.attributes.external_id;
      const decimalChainId = hexToNumber(
        hexChainId as `0x${string}`,
      ).toString();
      mapping[networkName] = decimalChainId;
    }

    const cacheDir = new CacheRouter().getZerionChainsCacheDir();
    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(mapping),
      this.chainsCacheTtlSeconds,
    );

    return mapping;
  }

  private async _getChainMapping(): Promise<Record<string, string>> {
    const cached = await this._getCachedChainMapping();
    if (cached) {
      return cached;
    }

    try {
      return await this._fetchAndCacheChainMapping();
    } catch (error) {
      this.loggingService.error(`Failed to fetch Zerion chains: ${error}`);
      return {};
    }
  }

  private async _mapNetworkToChainId(network: string): Promise<string> {
    const mapping = await this._getChainMapping();
    const chainId = mapping[network.toLowerCase()];

    if (!chainId) {
      this.loggingService.warn(
        `Unknown Zerion network: "${network}", defaulting to Ethereum mainnet (chain ID 1)`,
      );
      return '1';
    }

    return chainId;
  }
}
