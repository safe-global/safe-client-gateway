import { Inject, Injectable } from '@nestjs/common';
import { groupBy } from 'lodash';
import type { Address } from 'viem';
import { getAddress, hexToNumber, isAddress, type Hex } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { IPortfolioApi } from '@/modules/portfolio/interfaces/portfolio-api.interface';
import type { Portfolio } from '@/modules/portfolio/domain/entities/portfolio.entity';
import type { TokenBalance } from '@/modules/portfolio/domain/entities/token-balance.entity';
import type { AppBalance } from '@/modules/portfolio/domain/entities/app-balance.entity';
import type {
  AppPosition,
  AppPositionGroup,
} from '@/modules/portfolio/domain/entities/app-position.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import type { ZerionBalance } from '@/datasources/balances-api/entities/zerion-balance.entity';
import { ZerionBalancesSchema } from '@/datasources/balances-api/entities/zerion-balance.entity';
import { ZerionChainsSchema } from '@/modules/portfolio/datasources/entities/zerion-chain.entity';
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
    this.fiatCodes = this.configurationService.getOrThrow<Array<string>>(
      'balances.providers.zerion.currencies',
    );
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
   * @param {{ address: Address; fiatCode: string; trusted?: boolean }} args - Fetch parameters
   * @returns {Promise<Array<ZerionBalance>>} Promise that resolves to Zerion balance positions
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
   * @param {Array<ZerionBalance>} positions - Zerion balance positions
   * @returns {Promise<Raw<Portfolio>>} Promise that resolves to raw portfolio data
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
   * @param {Array<ZerionBalance>} positions - Zerion wallet positions
   * @returns {Promise<Array<TokenBalance>>} Promise that resolves to token balance entities
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
            position.attributes.value !== null
              ? getNumberString(position.attributes.value)
              : undefined,
          price:
            position.attributes.price !== null
              ? getNumberString(position.attributes.price)
              : undefined,
          priceChangePercentage1d:
            position.attributes.changes?.percent_1d !== null &&
            position.attributes.changes?.percent_1d !== undefined
              ? getNumberString(position.attributes.changes.percent_1d)
              : undefined,
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
   * @param {Array<ZerionBalance>} positions - Zerion app positions
   * @returns {Promise<Array<AppBalance>>} Promise that resolves to app balance entities
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
              logoUrl: appMetadata?.icon?.url ?? undefined,
              url: appMetadata?.url ?? undefined,
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
   * @param {Array<AppPosition>} positions - Positions to group
   * @returns {Array<AppPositionGroup>} Grouped positions
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
   * @param {Array<ZerionBalance>} positions - Zerion balance positions
   * @returns {Promise<Array<AppPosition>>} Promise that resolves to app position entities
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
            : undefined;

        return {
          key: position.id,
          type: position.attributes.position_type,
          name: position.attributes.name,
          groupId: position.attributes.group_id ?? undefined,
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
            position.attributes.value !== null
              ? getNumberString(position.attributes.value)
              : undefined,
          priceChangePercentage1d:
            position.attributes.changes?.percent_1d !== null &&
            position.attributes.changes?.percent_1d !== undefined
              ? getNumberString(position.attributes.changes.percent_1d)
              : undefined,
        };
      }),
    );

    return appPositions.filter((pos): pos is AppPosition => pos !== null);
  }

  /**
   * Calculates total fiat value of positions.
   *
   * @param {Array<ZerionBalance>} positions - Positions to calculate balance for
   * @returns {number} Total fiat value
   */
  private _calculateTotalBalance(positions: Array<ZerionBalance>): number {
    return positions.reduce((sum, position) => {
      return sum + (position.attributes.value ?? 0);
    }, 0);
  }

  /**
   * Calculates total fiat value of app positions.
   *
   * @param {Array<ZerionBalance>} positions - App positions to calculate balance for
   * @returns {number} Total fiat value
   */
  private _calculatePositionsBalance(positions: Array<ZerionBalance>): number {
    return positions.reduce((sum, position) => {
      return sum + (position.attributes.value ?? 0);
    }, 0);
  }

  /**
   * Retrieves cached chain mapping.
   *
   * @returns {Promise<Record<string, string> | null>} Promise that resolves to cached mapping or null
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
   *
   * @returns {Promise<Record<string, string>>} Promise that resolves to network to chain ID mapping
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
      const decimalChainId = hexToNumber(
        chain.attributes.external_id as Hex,
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
   *
   * @returns {Promise<Record<string, string>>} Promise that resolves to network to chain ID mapping
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
   * @param {string} network - Zerion network identifier
   * @returns {Promise<string>} Promise that resolves to chain ID (defaults to '1' if unknown)
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
