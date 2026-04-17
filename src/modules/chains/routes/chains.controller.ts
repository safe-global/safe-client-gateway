// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ChainsService } from '@/modules/chains/routes/chains.service';
import { AboutChain } from '@/modules/chains/routes/entities/about-chain.entity';
import {
  Backbone as ApiBackbone,
  type Backbone,
} from '@/modules/chains/routes/entities/backbone.entity';
import { Chain } from '@/modules/chains/routes/entities/chain.entity';
import { ChainPage } from '@/modules/chains/routes/entities/chain-page.entity';
import { GasPriceResponse } from '@/modules/chains/routes/entities/gas-price-response.entity';
import { IndexingStatus } from '@/modules/chains/routes/entities/indexing-status.entity';
import { MasterCopy } from '@/modules/chains/routes/entities/master-copy.entity';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import type { Page } from '@/routes/common/entities/page.entity';
import type { PaginationData } from '@/routes/common/pagination/pagination.data';

@ApiTags('chains')
@Controller({
  path: 'chains',
  version: '1',
})
export class ChainsController {
  constructor(private readonly chainsService: ChainsService) {}

  @ApiOperation({
    summary: 'Get supported chains',
    description:
      'Retrieves a paginated list of all blockchain networks supported by the Safe infrastructure, including their configuration and capabilities.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiOkResponse({
    type: ChainPage,
    description: 'Paginated list of supported chains',
  })
  @Get()
  getChains(
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<Chain>> {
    return this.chainsService.getChains(routeUrl, paginationData);
  }

  @ApiOperation({
    summary: 'Get chain details',
    description:
      'Retrieves detailed information about a specific blockchain network, including its configuration, features, and Safe-specific settings.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID of the blockchain network',
    example: '1',
  })
  @ApiOkResponse({
    type: Chain,
    description: 'Chain details retrieved successfully',
  })
  @Get('/:chainId')
  getChain(@Param('chainId') chainId: string): Promise<Chain> {
    return this.chainsService.getChain(chainId);
  }

  @ApiOperation({
    summary: 'Get chain information',
    description:
      'Retrieves general information about a blockchain network, including network details and statistics.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID of the blockchain network',
    example: '1',
  })
  @ApiOkResponse({
    type: AboutChain,
    description: 'Chain information retrieved successfully',
  })
  @Get('/:chainId/about')
  getAboutChain(@Param('chainId') chainId: string): Promise<AboutChain> {
    return this.chainsService.getAboutChain(chainId);
  }

  @ApiOperation({
    summary: 'Get chain backbone information',
    description:
      'Retrieves backbone infrastructure information for a specific chain, including API endpoints and service configurations.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID of the blockchain network',
    example: '1',
  })
  @ApiOkResponse({
    type: ApiBackbone,
    description: 'Chain backbone information retrieved successfully',
  })
  @Get('/:chainId/about/backbone')
  getBackbone(@Param('chainId') chainId: string): Promise<Backbone> {
    return this.chainsService.getBackbone(chainId);
  }

  @ApiOperation({
    summary: 'Get Safe master copy contracts',
    description:
      'Retrieves information about Safe master copy contracts deployed on the specified chain, including their addresses and versions.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID of the blockchain network',
    example: '1',
  })
  @ApiOkResponse({
    type: MasterCopy,
    isArray: true,
    description: 'List of Safe master copy contracts',
  })
  @Get('/:chainId/about/master-copies')
  getMasterCopies(
    @Param('chainId') chainId: string,
  ): Promise<Array<MasterCopy>> {
    return this.chainsService.getMasterCopies(chainId);
  }

  @ApiOperation({
    summary: 'Get chain indexing status',
    description:
      'Retrieves the current indexing status for a blockchain network, including the latest indexed block and synchronization state.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID of the blockchain network',
    example: '1',
  })
  @ApiOkResponse({
    type: IndexingStatus,
    description: 'Chain indexing status retrieved successfully',
  })
  @Get('/:chainId/about/indexing')
  getIndexingStatus(
    @Param('chainId') chainId: string,
  ): Promise<IndexingStatus> {
    return this.chainsService.getIndexingStatus(chainId);
  }

  @ApiOperation({ summary: 'Get gas price from oracle' })
  @ApiParam({ name: 'chainId', type: 'string', example: '1' })
  @ApiOkResponse({ type: GasPriceResponse })
  @Get('/:chainId/gas-price')
  getGasPrice(@Param('chainId') chainId: string): Promise<GasPriceResponse> {
    return this.chainsService.getGasPrice(chainId);
  }
}
