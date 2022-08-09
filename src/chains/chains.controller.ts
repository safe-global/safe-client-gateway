import { Controller, Get } from '@nestjs/common';
import { ChainsService } from './chains.service';
import { Chain } from './entities/chain.entity';
import { Page } from './entities/page.entity';

@Controller({
  path: 'chains',
  version: '1',
})
export class ChainsController {
  constructor(private readonly chainsService: ChainsService) {}

  @Get()
  async getChains(): Promise<Page<Chain>> {
    return this.chainsService.getChains();
  }
}
