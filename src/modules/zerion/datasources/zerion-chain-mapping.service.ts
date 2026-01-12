import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { ZerionChainsSchema } from '@/modules/portfolio/datasources/entities/zerion-chain.entity';
import { getZerionHeaders } from '@/modules/balances/datasources/zerion-api.helpers';
import { hexToNumber, isHex } from 'viem';

@Injectable()
export class ZerionChainMappingService {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly chainsCacheTtlSeconds = 86400; // 24 hours

  constructor(
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
  }

  /**
   * Gets chain ID from Zerion network name (for portfolio API).
   * Maps: network name -> chain ID
   *
   * @param networkName - Zerion network identifier (e.g., "ethereum", "polygon")
   * @param isTestnet - Whether this is a testnet request
   * @returns Chain ID as string (defaults to '1' if unknown)
   */
  async getChainIdFromNetwork(
    networkName: string,
    isTestnet: boolean,
  ): Promise<string> {
    const mapping = await this.getNetworkToChainIdMapping(isTestnet);
    const chainId = mapping[networkName.toLowerCase()];

    if (!chainId) {
      this.loggingService.warn(
        `Unknown Zerion network: "${networkName}", defaulting to Ethereum mainnet (chain ID 1)`,
      );
      return '1';
    }

    return chainId;
  }

  /**
   * Gets Zerion network name from chain ID (for positions API).
   * Maps: chain ID -> network name
   *
   * @param chainId - Chain ID as string
   * @param isTestnet - Whether this is a testnet request
   * @returns Zerion network name or undefined
   */
  async getNetworkFromChainId(
    chainId: string,
    isTestnet: boolean,
  ): Promise<string | undefined> {
    const mapping = await this.getChainIdToNetworkMapping(isTestnet);
    return mapping[chainId];
  }

  /**
   * Gets mapping: network name -> chain ID (for portfolio).
   */
  private async getNetworkToChainIdMapping(
    isTestnet: boolean,
  ): Promise<Record<string, string>> {
    const cached = await this._getCachedMapping(isTestnet, 'networkToChainId');
    if (cached) {
      return cached;
    }

    return await this._fetchAndCacheMapping(isTestnet);
  }

  /**
   * Gets mapping: chain ID -> network name (for positions).
   */
  private async getChainIdToNetworkMapping(
    isTestnet: boolean,
  ): Promise<Record<string, string>> {
    const cached = await this._getCachedMapping(isTestnet, 'chainIdToNetwork');
    if (cached) {
      return cached;
    }

    // Fetch network -> chainId mapping first
    const networkToChainId = await this._fetchAndCacheMapping(isTestnet);

    // Build reverse mapping: chainId -> network
    const chainIdToNetwork: Record<string, string> = {};
    for (const [network, chainId] of Object.entries(networkToChainId)) {
      chainIdToNetwork[chainId] = network;
    }

    // Cache the reverse mapping
    await this._cacheMapping(isTestnet, 'chainIdToNetwork', chainIdToNetwork);

    return chainIdToNetwork;
  }

  private async _getCachedMapping(
    isTestnet: boolean,
    direction: 'networkToChainId' | 'chainIdToNetwork',
  ): Promise<Record<string, string> | null> {
    const cacheDir = CacheRouter.getZerionChainsCacheDir(isTestnet);
    let field: string;
    if (direction === 'networkToChainId') {
      field = isTestnet ? 'mapping_testnet' : 'mapping';
    } else {
      field = isTestnet ? 'mapping_reverse_testnet' : 'mapping_reverse';
    }

    const cached = await this.cacheService.hGet({ ...cacheDir, field });
    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  }

  private async _cacheMapping(
    isTestnet: boolean,
    direction: 'networkToChainId' | 'chainIdToNetwork',
    mapping: Record<string, string>,
  ): Promise<void> {
    const cacheDir = CacheRouter.getZerionChainsCacheDir(isTestnet);
    let field: string;
    if (direction === 'networkToChainId') {
      field = isTestnet ? 'mapping_testnet' : 'mapping';
    } else {
      field = isTestnet ? 'mapping_reverse_testnet' : 'mapping_reverse';
    }

    await this.cacheService.hSet(
      { ...cacheDir, field },
      JSON.stringify(mapping),
      this.chainsCacheTtlSeconds,
    );
  }

  private async _fetchAndCacheMapping(
    isTestnet: boolean,
  ): Promise<Record<string, string>> {
    const url = `${this.baseUri}/v1/chains`;
    const networkRequest = {
      headers: getZerionHeaders(this.apiKey, isTestnet),
    };

    const response = await this.networkService
      .get({ url, networkRequest })
      .then(({ data }) => ZerionChainsSchema.parse(data));

    const mapping: Record<string, string> = {};
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
      mapping[networkName.toLowerCase()] = decimalChainId;
    }

    await this._cacheMapping(isTestnet, 'networkToChainId', mapping);
    return mapping;
  }
}
