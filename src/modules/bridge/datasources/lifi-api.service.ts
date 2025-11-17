import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { BridgeName } from '@/modules/bridge/domain/entities/bridge-name.entity';
import type { BridgeStatus } from '@/modules/bridge/domain/entities/bridge-status.entity';
import type { IBridgeApi } from '@/domain/interfaces/bridge-api.inferface';
import type { Raw } from '@/validation/entities/raw.entity';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { type BridgeChainPage } from '@/modules/bridge/domain/entities/bridge-chain.entity';
import type { Hash } from 'viem';

export class LifiBridgeApi implements IBridgeApi {
  public static readonly LIFI_API_HEADER = 'x-lifi-api-key';
  private static readonly CHAIN_TYPES = 'EVM';

  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly networkService: INetworkService,
    private readonly cacheFirstDataSource: CacheFirstDataSource,
    private readonly httpErrorFactory: HttpErrorFactory,
    private readonly configurationService: IConfigurationService,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  public async getChains(): Promise<Raw<BridgeChainPage>> {
    const url = `${this.baseUrl}/v1/chains`;
    const cacheDir = CacheRouter.getBridgeChainsCacheDir();
    try {
      return await this.cacheFirstDataSource.get<BridgeChainPage>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            chainTypes: LifiBridgeApi.CHAIN_TYPES,
          },
          headers: {
            [LifiBridgeApi.LIFI_API_HEADER]: this.apiKey,
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  public async getStatus(args: {
    txHash: Hash;
    bridge?: BridgeName;
    toChain?: string;
  }): Promise<Raw<BridgeStatus>> {
    try {
      const url = `${this.baseUrl}/v1/status`;
      const { data } = await this.networkService.get<BridgeStatus>({
        url,
        networkRequest: {
          params: {
            txHash: args.txHash,
            fromChain: this.chainId,
            toChain: args.toChain,
            bridge: args.bridge,
          },
          headers: {
            [LifiBridgeApi.LIFI_API_HEADER]: this.apiKey,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
