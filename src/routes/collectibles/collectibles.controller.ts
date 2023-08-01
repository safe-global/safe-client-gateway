import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { CollectiblesService } from './collectibles.service';
import { ApiImplicitQuery } from '@nestjs/swagger/dist/decorators/api-implicit-query.decorator';
import { CollectiblePage } from './entities/collectible.page.entity';
import { Collectible } from './entities/collectible.entity';
import { RouteUrlDecorator } from '../common/decorators/route.url.decorator';
import { PaginationDataDecorator } from '../common/decorators/pagination.data.decorator';
import { PaginationData } from '../common/pagination/pagination.data';
import { Page } from '../common/entities/page.entity';

@ApiTags('collectibles')
@Controller({
  version: '2',
})
export class CollectiblesController {
  constructor(private readonly service: CollectiblesService) {}

  @ApiOkResponse({ type: CollectiblePage })
  @ApiImplicitQuery({
    name: 'trusted',
    required: false,
    type: Boolean,
  })
  @ApiImplicitQuery({
    name: 'exclude_spam',
    required: false,
    type: Boolean,
  })
  @ApiImplicitQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('chains/:chainId/safes/:safeAddress/collectibles')
  async getCollectibles(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('trusted') trusted?: boolean,
    @Query('exclude_spam') excludeSpam?: boolean,
  ): Promise<Page<Collectible>> {
    return this.service.getCollectibles({
      chainId,
      safeAddress,
      routeUrl,
      paginationData,
      trusted,
      excludeSpam,
    });
  }
}
