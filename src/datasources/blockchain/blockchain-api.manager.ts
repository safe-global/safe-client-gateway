import { IConfigurationService } from '@/config/configuration.service.interface';
import { Chain as DomainChain } from '@/domain/chains/entities/chain.entity';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Chain, PublicClient, createPublicClient, http } from 'viem';

@Injectable()
export class BlockchainApiManager implements IBlockchainApiManager {
  private static readonly INFURA_URL_PATTERN = 'infura';
  private readonly blockchainApiMap: Record<string, PublicClient> = {};
  private readonly infuraApiKey: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
  ) {
    this.infuraApiKey = this.configurationService.getOrThrow<string>(
      'blockchain.infura.apiKey',
    );
  }

  async getApi(chainId: string): Promise<PublicClient> {
    const blockchainApi = this.blockchainApiMap[chainId];
    if (blockchainApi) {
      return blockchainApi;
    }

    const chain = await this.configApi.getChain(chainId);
    this.blockchainApiMap[chainId] = this.createClient(chain);

    return this.blockchainApiMap[chainId];
  }

  destroyApi(chainId: string): void {
    if (this.blockchainApiMap?.[chainId]) {
      delete this.blockchainApiMap[chainId];
    }
  }

  private createClient(chain: DomainChain): PublicClient {
    return createPublicClient({
      chain: this.formatChain(chain),
      transport: http(),
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
