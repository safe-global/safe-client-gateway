import { Inject, Injectable } from '@nestjs/common';
import { groupBy } from 'lodash';
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
import type {
  AppPosition,
  AppPositionGroup,
} from '@/domain/portfolio/entities/app-position.entity';
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
import { getNumberString } from '@/domain/common/utils/utils';

/**
 * Zerion portfolio API integration.
 * Maps Zerion (external IN) API responses to domain (internal) portfolio structure.
 * Zerion returns an unfiltered and unordered list of wallet positions (tokens) and complex positions (positions).
 * This service transforms them into:
 *
 * Portfolio
 *   ├── tokenBalances: TokenBalance[]
 *   └── positionBalances: AppBalance[]
 *       └── AppBalance
 *           ├── appInfo
 *           ├── balanceFiat
 *           └── groups: AppPositionGroup[]
 *               └── AppPositionGroup
 *                   ├── name
 *                   └── items: AppPosition[]
 */
@Injectable()
export class ZerionPortfolioApi implements IPortfolioApi {
  private readonly apiKey: string;
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
    this.apiKey = this.configurationService.getOrThrow<string>(
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
    if (!this.fiatCodes.includes(args.fiatCode.toUpperCase())) {
      throw new DataSourceError(
        `Unsupported currency code: ${args.fiatCode}`,
        400,
      );
    }

    const positions = await this._fetchPositions(args);
    return await this._buildPortfolio(positions);
  }

  /**
   * Fetches positions from Zerion API.
   *
   * @param args - Fetch parameters
   */
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
   * Maps Zerion positions to domain portfolio.
   *
   * @param positions - Zerion balance positions
   */
  private async _buildPortfolio(
    positions: Array<ZerionBalance>,
  ): Promise<Raw<Portfolio>> {
    const displayablePositions = positions.filter(
      (p) => p.attributes.flags.displayable,
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

    const totalBalanceFiat = getNumberString(
      this._calculateTotalBalance(displayablePositions),
    );
    const totalTokenBalanceFiat = getNumberString(
      this._calculateTotalBalance(walletPositions),
    );
    const totalPositionsBalanceFiat = getNumberString(
      this._calculateTotalBalance(appPositions),
    );

    return rawify({
      totalBalanceFiat,
      totalTokenBalanceFiat,
      totalPositionsBalanceFiat,
      tokenBalances,
      positionBalances: appBalances,
    });
  }

  /**
   * Maps Zerion wallet positions to domain TokenBalance entities.
   *
   * @param positions - Zerion wallet positions
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
          balance: position.attributes.quantity.int,
          balanceFiat:
            position.attributes.value !== null &&
            position.attributes.value !== undefined
              ? getNumberString(position.attributes.value)
              : null,
          price:
            position.attributes.price !== null &&
            position.attributes.price !== undefined
              ? getNumberString(position.attributes.price)
              : null,
          priceChangePercentage1d:
            position.attributes.changes?.percent_1d !== null &&
            position.attributes.changes?.percent_1d !== undefined
              ? getNumberString(position.attributes.changes.percent_1d)
              : null,
        };
      }),
    );

    return tokenBalances.filter(
      (token): token is TokenBalance => token !== null,
    );
  }

  /**
   * Maps Zerion app positions to domain AppBalance entities, grouped by app and group_id.
   *
   * @param positions - Zerion app positions
   */
  private async _buildAppBalances(
    positions: Array<ZerionBalance>,
  ): Promise<Array<AppBalance>> {
    const groupedByApp = new Map<string, Array<ZerionBalance>>();

    for (const position of positions) {
      const appName =
        position.attributes.application_metadata?.name ??
        position.attributes.protocol ??
        'Unknown';
      if (!groupedByApp.has(appName)) {
        groupedByApp.set(appName, []);
      }
      groupedByApp.get(appName)!.push(position);
    }

    return Promise.all(
      Array.from(groupedByApp.entries()).map(
        async ([appName, appPositions]): Promise<AppBalance> => {
          const appMetadata = appPositions[0].attributes.application_metadata;

          const positions = await this._buildAppPositions(appPositions);

          const groups = this.groupPositions(positions);

          return {
            appInfo: {
              name: appName,
              logoUrl: appMetadata?.icon?.url ?? null,
              url: appMetadata?.url ?? null,
            },
            balanceFiat: getNumberString(
              this._calculatePositionsBalance(appPositions),
            ),
            groups,
          };
        },
      ),
    );
  }

  /**
   * Groups positions by group_id, using name as fallback.
   * Group name is taken from the first position's name field.
   *
   * @param positions - Positions to group
   */
  private groupPositions(
    positions: Array<AppPosition>,
  ): Array<AppPositionGroup> {
    const grouped = groupBy(positions, (position) => {
      return position.groupId ?? position.name;
    });

    return Object.values(grouped).map((items) => {
      const groupName = items[0]?.name ?? 'Unknown';
      return {
        name: groupName,
        items,
      };
    });
  }

  /**
   * Maps Zerion positions to domain AppPosition entities.
   *
   * @param positions - Zerion balance positions
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

        const poolAddress = position.attributes.pool_address;
        const receiptTokenAddress =
          poolAddress != null && isAddress(poolAddress)
            ? getAddress(poolAddress)
            : null;

        return {
          key: position.id,
          type: position.attributes.position_type,
          name: position.attributes.name,
          groupId: position.attributes.group_id ?? null,
          tokenInfo: {
            address,
            decimals: impl.decimals,
            symbol: position.attributes.fungible_info.symbol ?? '',
            name: position.attributes.fungible_info.name ?? '',
            logoUri: position.attributes.fungible_info.icon?.url ?? '',
            chainId,
            trusted: position.attributes.fungible_info.flags?.verified ?? false,
            type:
              address === null ||
              address === '0x0000000000000000000000000000000000000000'
                ? ('NATIVE_TOKEN' as const)
                : ('ERC20' as const),
          },
          receiptTokenAddress,
          balance: position.attributes.quantity.int,
          balanceFiat:
            position.attributes.value == null
              ? null
              : getNumberString(position.attributes.value),
          priceChangePercentage1d:
            position.attributes.changes?.percent_1d !== null &&
            position.attributes.changes?.percent_1d !== undefined
              ? getNumberString(position.attributes.changes.percent_1d)
              : null,
        };
      }),
    );

    return appPositions.filter((pos): pos is AppPosition => pos !== null);
  }

  /**
   * Calculates total fiat value of positions.
   *
   * @param positions - Positions to calculate balance for
   */
  private _calculateTotalBalance(positions: Array<ZerionBalance>): number {
    return positions.reduce((sum, position) => {
      return sum + (position.attributes.value ?? 0);
    }, 0);
  }

  /**
   * Calculates total fiat value of app positions.
   *
   * @param positions - App positions to calculate balance for
   */
  private _calculatePositionsBalance(positions: Array<ZerionBalance>): number {
    return positions.reduce((sum, position) => {
      return sum + (position.attributes.value ?? 0);
    }, 0);
  }

  /**
   * Retrieves cached chain mapping.
   */
  private async _getCachedChainMapping(): Promise<Record<
    string,
    string
  > | null> {
    const cacheDir = CacheRouter.getZerionChainsCacheDir();
    const cached = await this.cacheService.hGet(cacheDir);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  }

  /**
   * Fetches and caches Zerion network to chain ID mapping.
   */
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

    const cacheDir = CacheRouter.getZerionChainsCacheDir();
    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(mapping),
      this.chainsCacheTtlSeconds,
    );

    return mapping;
  }

  /**
   * Gets chain mapping from cache or fetches if missing.
   */
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

  /**
   * Maps Zerion network identifier to chain ID.
   *
   * @param network - Zerion network identifier
   */
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
