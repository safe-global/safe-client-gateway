import { IConfigurationService } from '@/config/configuration.service.interface';
import { Chain as DomainChain } from '@/domain/chains/entities/chain.entity';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Chain, PublicClient, createPublicClient, http } from 'viem';

@Injectable()
export class BlockchainApiManager implements IBlockchainApiManager {
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

  async getBlockchainApi(chainId: string): Promise<PublicClient> {
    const blockchainApi = this.blockchainApiMap[chainId];
    if (blockchainApi) {
      return blockchainApi;
    }

    const chain = await this.configApi.getChain(chainId);
    this.blockchainApiMap[chainId] = this.createClient(chain);

    return this.blockchainApiMap[chainId];
  }

  destroyBlockchainApi(chainId: string): void {
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

  private formatRpcUri(rpcUri: DomainChain['rpcUri']): string {
    return rpcUri.authentication === RpcUriAuthentication.ApiKeyPath
      ? rpcUri.value + this.infuraApiKey
      : rpcUri.value;
  }
}
