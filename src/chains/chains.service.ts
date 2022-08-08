import { Inject, Injectable } from '@nestjs/common';
import { ISafeConfigService } from '../services/safe-config/safe-config.service';
import { Chain } from './entities/chain.entity';
import { Page } from './entities/page.entity';

@Injectable()
export class ChainsService {
  constructor(
    @Inject('ISafeConfigService')
    private readonly safeConfigService: ISafeConfigService,
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
}
