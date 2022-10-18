import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { DelegatesService } from './delegates.service';
import { ApiImplicitQuery } from '@nestjs/swagger/dist/decorators/api-implicit-query.decorator';
import { Delegate } from './entities/delegate.entity';
import { DelegatePage } from './entities/delegate.page.entity';
import { RouteUrlDecorator } from '../common/decorators/route.url.decorator';
import { PaginationDataDecorator } from '../common/decorators/pagination.data.decorator';
import { PaginationData } from '../common/pagination/pagination.data';
import { Page } from '../common/entities/page.entity';

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
    @PaginationDataDecorator() paginationData?: PaginationData,
    @Query('safe') safe?: string,
    @Query('delegate') delegate?: string,
    @Query('delegator') delegator?: string,
    @Query('label') label?: string,
  ): Promise<Page<Delegate>> {
    return this.service.getDelegates(
      chainId,
      routeUrl,
      safe,
      delegate,
      delegator,
      label,
      paginationData,
    );
  }
}
