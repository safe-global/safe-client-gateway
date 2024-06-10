import { IConfigurationService } from '@/config/configuration.service.interface';
import { BlockchainApi } from '@/datasources/blockchain/blockchain-api.service';
import { IBlockchainApi } from '@/domain/interfaces/blockchain-api.interface';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class BlockchainApiManager implements IBlockchainApiManager {
  private blockchainApiMap: Record<string, IBlockchainApi> = {};

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
  ) {}

  async getBlockchainApi(chainId: string): Promise<IBlockchainApi> {
    const blockchainApi = this.blockchainApiMap[chainId];
    if (blockchainApi) {
      return blockchainApi;
    }

    const chain = await this.configApi.getChain(chainId);
    this.blockchainApiMap[chainId] = new BlockchainApi(
      this.configurationService,
      chain,
      this.destroyBlockchainApi,
    );
    return this.blockchainApiMap[chainId];
  }

  destroyBlockchainApi(chainId: string): void {
    if (this.blockchainApiMap?.[chainId]) {
      delete this.blockchainApiMap[chainId];
    }
  }
}
