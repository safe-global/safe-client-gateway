import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { Chain as DomainChain } from '@/domain/chains/entities/chain.entity';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';
import { ChainSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { Inject, Injectable } from '@nestjs/common';
import {
  Chain,
  PublicClient,
  RpcRequestError,
  createPublicClient,
  custom,
} from 'viem';
import { getHttpRpcClient } from 'viem/utils';

@Injectable()
export class BlockchainApiManager implements IBlockchainApiManager {
  private static readonly INFURA_URL_PATTERN = 'infura';
  private readonly blockchainApiMap: Record<string, PublicClient> = {};
  private readonly infuraApiKey: string;
  private readonly rpcExpirationTimeInSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {
    this.infuraApiKey = this.configurationService.getOrThrow<string>(
      'blockchain.infura.apiKey',
    );
    this.rpcExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.rpc',
      );
  }

  async getApi(chainId: string): Promise<PublicClient> {
    const blockchainApi = this.blockchainApiMap[chainId];
    if (blockchainApi) {
      return blockchainApi;
    }

    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);
    this.blockchainApiMap[chainId] = this._createCachedRpcClient(chain);

    return this.blockchainApiMap[chainId];
  }

  destroyApi(chainId: string): void {
    if (!this.blockchainApiMap?.[chainId]) {
      return;
    }

    delete this.blockchainApiMap[chainId];

    const key = CacheRouter.getRpcRequestsKey(chainId);
    void this.cacheService.deleteByKey(key);
  }

  /**
   * Creates a {@link PublicClient} with a cache layer for RPC requests
   * @param domainChain {@link DomainChain} to create the client for
   */
  _createCachedRpcClient(domainChain: DomainChain): PublicClient {
    const chain = this.formatChain(domainChain);

    const rpcUrl = chain.rpcUrls.default.http[0];
    const rpcClient = getHttpRpcClient(rpcUrl);

    const request = async (body: {
      method: string;
      params?: unknown;
    }): Promise<unknown> => {
      const cacheDir = CacheRouter.getRpcRequestsCacheDir({
        chainId: domainChain.chainId,
        method: body.method,
        params: ((): string => {
          try {
            // We cannot be certain of the shape of the params object
            return JSON.stringify(body.params);
          } catch {
            return '';
          }
        })(),
      });

      const cache = await this.cacheService.hGet(cacheDir);

      if (cache != null) {
        return JSON.parse(cache);
      }

      const { error, result } = await rpcClient.request({
        body,
      });

      if (error) {
        throw new RpcRequestError({
          body,
          error,
          url: rpcUrl,
        });
      }

      await this.cacheService.hSet(
        cacheDir,
        JSON.stringify(result),
        this.rpcExpirationTimeInSeconds,
      );

      return result;
    };

    return createPublicClient({
      chain,
      transport: custom({
        request,
      }),
    });
  }

  private formatChain(chain: DomainChain): Chain {
    return {
      id: Number(chain.chainId),
      name: chain.chainName,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: {
        default: {
          http: [this.formatRpcUri(chain.rpcUri)],
        },
      },
    };
  }

  /**
   * Formats rpcUri to include the Infura API key if the rpcUri is an Infura URL
   * and the authentication method is {@link RpcUriAuthentication.ApiKeyPath}.
   * @param rpcUri rpcUri to format
   * @returns Formatted rpcUri
   */
  private formatRpcUri(rpcUri: DomainChain['rpcUri']): string {
    return rpcUri.authentication === RpcUriAuthentication.ApiKeyPath &&
      rpcUri.value.includes(BlockchainApiManager.INFURA_URL_PATTERN)
      ? rpcUri.value + this.infuraApiKey
      : rpcUri.value;
  }
}
