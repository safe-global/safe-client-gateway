import { Controller, Get, Param } from '@nestjs/common';
import { Page } from '../common/entities/page.entity';
import { ChainsService } from './chains.service';
import { Backbone, Chain } from './entities';
import { PaginationData } from '../common/pagination/pagination.data';
import { RouteUrlDecorator } from '../common/decorators/route.url.decorator';
import { PaginationDataDecorator } from '../common/decorators/pagination.data.decorator';

@Controller({
  path: 'chains',
  version: '1',
})
export class ChainsController {
  constructor(private readonly chainsService: ChainsService) {}

  @Get()
  async getChains(
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData?: PaginationData,
  ): Promise<Page<Chain>> {
    return this.chainsService.getChains(routeUrl, paginationData);
  }

  @Get('/:chainId/about/backbone')
  async getBackbone(@Param('chainId') chainId: string): Promise<Backbone> {
    return this.chainsService.getBackbone(chainId);
  }
}
