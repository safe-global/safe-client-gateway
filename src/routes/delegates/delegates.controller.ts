import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DelegatesService } from './delegates.service';
import { ApiImplicitQuery } from '@nestjs/swagger/dist/decorators/api-implicit-query.decorator';
import { Delegate } from './entities/delegate.entity';
import { DelegatePage } from './entities/delegate.page.entity';
import { RouteUrlDecorator } from '../common/decorators/route.url.decorator';
import { PaginationDataDecorator } from '../common/decorators/pagination.data.decorator';
import { PaginationData } from '../common/pagination/pagination.data';
import { Page } from '../common/entities/page.entity';
import { DelegateParamsDto } from './entities/delegate-params.entity';
import { CreateDelegateDto } from './entities/create-delegate.entity';
import { NetworkResponse } from '../../datasources/network/entities/network.response.entity';

@ApiTags('delegates')
@Controller({
  version: '1',
})
export class DelegatesController {
  constructor(private readonly service: DelegatesService) {}

  @ApiOkResponse({ type: DelegatePage })
  @ApiImplicitQuery({
    name: 'safe',
    required: false,
    type: String,
  })
  @ApiImplicitQuery({
    name: 'delegate',
    required: false,
    type: String,
  })
  @ApiImplicitQuery({
    name: 'delegator',
    required: false,
    type: String,
  })
  @ApiImplicitQuery({
    name: 'label',
    required: false,
    type: String,
  })
  @ApiImplicitQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('chains/:chainId/delegates')
  async getDelegates(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Query() delegateParamsDto: DelegateParamsDto,
    @PaginationDataDecorator() paginationData?: PaginationData,
  ): Promise<Page<Delegate>> {
    return this.service.getDelegates(
      chainId,
      routeUrl,
      delegateParamsDto,
      paginationData,
    );
  }

  @ApiCreatedResponse()
  @Post('chains/:chainId/delegates')
  async getDataDecoded(
    @Param('chainId') chainId: string,
    @Body() createDelegateDto: CreateDelegateDto,
  ): Promise<NetworkResponse> {
    return this.service.postDelegates(chainId, createDelegateDto);
  }
}
