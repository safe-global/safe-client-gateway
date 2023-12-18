import { Inject, Injectable } from '@nestjs/common';
import {
  Chain,
  PublicClient,
  createPublicClient as _createPublicClient,
  http,
} from 'viem';
import { IBlockchainDataSource } from '@/domain/interfaces/blockchain.datasource.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class BlockchainDataSource implements IBlockchainDataSource {
  private readonly infuraToken: string | undefined;

  constructor(
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject('createPublicClient')
    private readonly createPublicClient: typeof _createPublicClient,
  ) {
    this.infuraToken = this.configurationService.get('blockchain.infuraToken');
  }

  async getPublicClient(chainId: string): Promise<PublicClient> {
    const chain = await this.chainsRepository.getChain(chainId);

    const rpcUrl =
      chain.rpcUri.authentication === RpcUriAuthentication.ApiKeyPath &&
      this.infuraToken
        ? chain.rpcUri.value + this.infuraToken
        : chain.rpcUri.value;

    const chainConfig: Chain = {
      id: Number(chain.chainId),
      name: chain.chainName,
      network: chain.chainName.toLowerCase(),
      nativeCurrency: {
        name: chain.nativeCurrency.name,
        symbol: chain.nativeCurrency.symbol,
        decimals: chain.nativeCurrency.decimals,
      },
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
      },
    };

    return this.createPublicClient({
      chain: chainConfig,
      transport: http(),
    });
  }
}
