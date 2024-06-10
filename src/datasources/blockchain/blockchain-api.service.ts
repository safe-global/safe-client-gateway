import { IConfigurationService } from '@/config/configuration.service.interface';
import { Chain as DomainChain } from '@/domain/chains/entities/chain.entity';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';
import { IBlockchainApi } from '@/domain/interfaces/blockchain-api.interface';
import { Injectable } from '@nestjs/common';
import { Chain, PublicClient, createPublicClient, http } from 'viem';

@Injectable()
export class BlockchainApi implements IBlockchainApi {
  private readonly infuraApiKey: string;

  constructor(
    private readonly configurationService: IConfigurationService,
    private readonly chain: DomainChain,
    public readonly destroyClient: (chainId: string) => void,
  ) {
    this.infuraApiKey = this.configurationService.getOrThrow<string>(
      'blockchain.infura.apiKey',
    );
  }

  getClient(): PublicClient {
    // TODO: Error handling
    return createPublicClient({
      chain: this.getChain(),
      transport: http(),
    });
  }

  private getChain(): Chain {
    return {
      id: +this.chain.chainId,
      name: this.chain.chainName,
      nativeCurrency: this.chain.nativeCurrency,
      rpcUrls: {
        default: {
          http: [this.formatRpcUri(this.chain.rpcUri)],
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
