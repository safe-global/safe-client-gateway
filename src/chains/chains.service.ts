import { Injectable } from '@nestjs/common';
import { ConfigApi } from '../datasources/config-api/config-api.service';
import { TransactionApiManager } from '../datasources/transaction-api/transaction-api.manager';
import { Backbone, Chain, Page } from './entities';

@Injectable()
export class ChainsService {
  constructor(
    private readonly configApi: ConfigApi,
    private readonly transactionServiceManager: TransactionApiManager,
  ) {}

  async getChains(): Promise<Page<Chain>> {
    const result = await this.configApi.getChains();
    const page: Page<Chain> = {
      count: result.count,
      next: result.next,
      previous: result.previous,
      results: result.results.map(
        (chain) =>
          <Chain>{
            chainId: chain.chainId,
            chainName: chain.chainName,
            vpcTransactionService: chain.vpcTransactionService,
          },
      ),
    };
    return page;
  }

  async getBackbone(chainId: string): Promise<Backbone> {
    const transactionService =
      await this.transactionServiceManager.getTransactionService(chainId);
    return transactionService.getBackbone();
  }
}
