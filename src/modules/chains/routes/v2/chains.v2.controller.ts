import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { ChainsV2Service } from './chains.v2.service';
import { ChainPage } from '@/modules/chains/routes/entities/chain-page.entity';
import { Chain } from '@/modules/chains/routes/entities/chain.entity';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';

@ApiTags('chains')
@Controller({
  path: 'chains',
  version: '2',
})
export class ChainsV2Controller {
  constructor(private readonly chainsV2Service: ChainsV2Service) {}

  @ApiOperation({
    summary: 'Get supported chains (v2)',
    description:
      'Retrieves a paginated list of all blockchain networks supported by the Safe infrastructure, with features scoped to the configured service key (e.g., "frontend").',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiOkResponse({
    type: ChainPage,
    description:
      'Paginated list of supported chains with service-scoped features',
  })
  @Get()
  async getChains(
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<Chain>> {
    return this.chainsV2Service.getChains(routeUrl, paginationData);
  }

  @ApiOperation({
    summary: 'Get chain details (v2)',
    description:
      'Retrieves detailed information about a specific blockchain network, with features scoped to the configured service key.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID of the blockchain network',
    example: '1',
  })
  @ApiOkResponse({
    type: Chain,
    description: 'Chain details with service-scoped features',
  })
  @Get('/:chainId')
  async getChain(@Param('chainId') chainId: string): Promise<Chain> {
    return this.chainsV2Service.getChain(chainId);
  }
}
