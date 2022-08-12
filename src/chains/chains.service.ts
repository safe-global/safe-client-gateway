import { Injectable } from '@nestjs/common';
import { SafeConfigChain } from '../services/safe-config/entities/chain.entity';
import { SafeConfigService } from '../services/safe-config/safe-config.service';
import { SafeTransactionManager } from '../services/safe-transaction/safe-transaction.manager';
import { Backbone } from './entities/backbone.entity';
import { Chain } from './entities/chain.entity';
import { Page } from './entities/page.entity';
// TODO: merge imports by adding an index?

@Injectable()
export class ChainsService {
  constructor(
    private readonly safeConfigService: SafeConfigService,
    private readonly safeTransactionManager: SafeTransactionManager,
  ) {}

  async getChains(): Promise<Page<Chain>> {
    const result = await this.safeConfigService.getChains();
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
      await this.safeTransactionManager.getTransactionService(chainId);

    return transactionService.getBackbone();
  }
}
