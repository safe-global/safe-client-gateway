import { Inject, Injectable } from '@nestjs/common';
import { hexToNumber, isHex } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { ZerionChainsSchema } from '@/modules/portfolio/datasources/entities/zerion-chain.entity';
import { getZerionHeaders } from '@/modules/balances/datasources/zerion-api.helpers';

export const IZerionChainMappingService = Symbol('IZerionChainMappingService');

export interface IZerionChainMappingService {
  /**
   * Maps chain ID to Zerion network name.
   *
   * @param {string} chainId - Decimal chain ID (e.g., '1', '137')
   * @param {boolean} isTestnet - Whether to use testnet mapping
   * @returns {Promise<string | null>} Network name or null if not found
   */
  getNetworkNameFromChainId(
    chainId: string,
    isTestnet: boolean,
  ): Promise<string | null>;

  /**
   * Maps Zerion network name to chain ID.
   *
   * @param {string} networkName - Zerion network name (e.g., 'ethereum', 'polygon')
   * @param {boolean} isTestnet - Whether to use testnet mapping
   * @returns {Promise<string | null>} Chain ID or null if not found
   */
  getChainIdFromNetworkName(
    networkName: string,
    isTestnet: boolean,
  ): Promise<string | null>;
}

interface ChainMappings {
  chainIdToName: Record<string, string>;
  nameToChainId: Record<string, string>;
}

/**
 * Maps between EVM chain IDs and Zerion network names.
 *
 * Zerion API uses internal network names (e.g., 'ethereum', 'polygon', 'arbitrum')
 * instead of standard EVM chain IDs (e.g., '1', '137', '42161').
 *
 * Note: Zerion confusingly calls these network names "chain_ids" in their API
 * (e.g., `filter[chain_ids]=ethereum`), but they are NOT EVM chain IDs.
 * The actual EVM chain ID is returned as `external_id` (hex) in the /v1/chains response.
 *
 * This service fetches the mapping from Zerion's /v1/chains endpoint and caches it.
 *
 * @see https://developers.zerion.io/reference/listchains
 */
@Injectable()
export class ZerionChainMappingService implements IZerionChainMappingService {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly cacheTtlSeconds: number;

  constructor(
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
    this.cacheTtlSeconds = this.configurationService.getOrThrow<number>(
      'balances.providers.zerion.chainsCacheTtlSeconds',
    );
  }

  async getNetworkNameFromChainId(
    chainId: string,
    isTestnet: boolean,
  ): Promise<string | null> {
    const mappings = await this._getMappings(isTestnet);
    return mappings.chainIdToName[chainId] ?? null;
  }

  async getChainIdFromNetworkName(
    networkName: string,
    isTestnet: boolean,
  ): Promise<string | null> {
    const mappings = await this._getMappings(isTestnet);
    return mappings.nameToChainId[networkName.toLowerCase()] ?? null;
  }

  private async _getMappings(isTestnet: boolean): Promise<ChainMappings> {
    const cached = await this._getCachedMappings(isTestnet);
    if (cached) {
      return cached;
    }

    try {
      return await this._fetchAndCacheMappings(isTestnet);
    } catch (error) {
      this.loggingService.error(`Failed to fetch Zerion chains: ${error}`);
      return { chainIdToName: {}, nameToChainId: {} };
    }
  }

  private async _getCachedMappings(
    isTestnet: boolean,
  ): Promise<ChainMappings | null> {
    const cacheDir = CacheRouter.getZerionChainsCacheDir(isTestnet);
    const cached = await this.cacheService.hGet(cacheDir);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  }

  private async _fetchAndCacheMappings(
    isTestnet: boolean,
  ): Promise<ChainMappings> {
    const url = `${this.baseUri}/v1/chains`;
    const networkRequest = {
      headers: getZerionHeaders(this.apiKey, isTestnet),
    };

    const response = await this.networkService
      .get({ url, networkRequest })
      .then(({ data }) => ZerionChainsSchema.parse(data));

    const mappings: ChainMappings = {
      chainIdToName: {},
      nameToChainId: {},
    };

    for (const chain of response.data) {
      const networkName = chain.id;
      const externalId = chain.attributes.external_id;

      if (!isHex(externalId)) {
        this.loggingService.warn(
          `Invalid external_id for chain ${networkName}: ${externalId}`,
        );
        continue;
      }

      const decimalChainId = hexToNumber(externalId).toString();
      mappings.chainIdToName[decimalChainId] = networkName;
      mappings.nameToChainId[networkName.toLowerCase()] = decimalChainId;
    }

    const cacheDir = CacheRouter.getZerionChainsCacheDir(isTestnet);
    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(mappings),
      this.cacheTtlSeconds,
    );

    return mappings;
  }
}
