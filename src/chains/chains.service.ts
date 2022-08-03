import { Injectable } from '@nestjs/common';
import { SafeConfigService } from '../services/safe-config/safe-config.service';
import { Chain } from './entities/chain.entity';
import { Page } from './entities/page.entity';

@Injectable()
export class ChainsService {
  constructor(private readonly safeConfigService: SafeConfigService) {}

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
