import { Controller, Get, Param } from '@nestjs/common';
import { ChainsService } from './chains.service';
import { PaginationData } from '../common/pagination/pagination.data';
import { RouteUrlDecorator } from '../common/decorators/route.url.decorator';
import { PaginationDataDecorator } from '../common/decorators/pagination.data.decorator';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Backbone as ApiBackbone, Backbone } from './entities/backbone.entity';
import { ChainPage } from './entities/chain-page.entity';
import { MasterCopy } from './entities/master-copy.entity';
import { Page } from '../common/entities/page.entity';
import { Chain } from './entities/chain.entity';
import { AboutChain } from './entities/about-chain.entity';

@ApiTags('chains')
@Controller({
  path: 'chains',
  version: '1',
})
export class ChainsController {
  constructor(private readonly chainsService: ChainsService) {}

  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @ApiOkResponse({ type: ChainPage })
  @Get()
  async getChains(
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<Chain>> {
    return this.chainsService.getChains(routeUrl, paginationData);
  }

  @ApiOkResponse({ type: Chain })
  @Get('/:chainId')
  async getChain(@Param('chainId') chainId: string): Promise<Chain> {
    return this.chainsService.getChain(chainId);
  }

  @ApiOkResponse({ type: AboutChain })
  @Get('/:chainId/about')
  async getAboutChain(@Param('chainId') chainId: string): Promise<AboutChain> {
    return this.chainsService.getAboutChain(chainId);
  }

  @ApiOkResponse({ type: ApiBackbone })
  @Get('/:chainId/about/backbone')
  async getBackbone(@Param('chainId') chainId: string): Promise<Backbone> {
    return this.chainsService.getBackbone(chainId);
  }

  @ApiOkResponse({ type: MasterCopy, isArray: true })
  @Get('/:chainId/about/master-copies')
  async getMasterCopies(
    @Param('chainId') chainId: string,
  ): Promise<MasterCopy[]> {
    return this.chainsService.getMasterCopies(chainId);
  }
}
