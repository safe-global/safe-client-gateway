import { Controller, Get, Param, Query } from '@nestjs/common';
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
import { ChainsV2QuerySchema } from '@/modules/chains/routes/v2/entities/schemas/chains-v2-query.schema';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

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
      'Retrieves a paginated list of all blockchain networks supported by the Safe infrastructure, with features scoped to the service key.',
  })
  @ApiQuery({
    name: 'serviceKey',
    required: true,
    type: String,
    description:
      'Service key for scoping chain features (e.g., WALLET_WEB, MOBILE)',
    example: 'WALLET_WEB',
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
    @Query(new ValidationPipe(ChainsV2QuerySchema))
    query: { serviceKey: string },
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<Chain>> {
    return this.chainsV2Service.getChains(
      query.serviceKey,
      routeUrl,
      paginationData,
    );
  }

  @ApiOperation({
    summary: 'Get chain details (v2)',
    description:
      'Retrieves detailed information about a specific blockchain network, with features scoped to the service key.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID of the blockchain network',
    example: '1',
  })
  @ApiQuery({
    name: 'serviceKey',
    required: true,
    type: String,
    description:
      'Service key for scoping chain features (e.g., WALLET_WEB, MOBILE)',
    example: 'WALLET_WEB',
  })
  @ApiOkResponse({
    type: Chain,
    description: 'Chain details with service-scoped features',
  })
  @Get(':chainId')
  async getChain(
    @Param('chainId') chainId: string,
    @Query(new ValidationPipe(ChainsV2QuerySchema))
    query: { serviceKey: string },
  ): Promise<Chain> {
    return this.chainsV2Service.getChain(query.serviceKey, chainId);
  }
}
