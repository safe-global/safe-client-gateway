import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
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
import { DeleteDelegateDto } from './entities/delete-delegate.entity';
import { DeleteSafeDelegateRequest } from './entities/delete-safe-delegate-request.entity';

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
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<Delegate>> {
    return this.service.getDelegates(
      chainId,
      routeUrl,
      delegateParamsDto,
      paginationData,
    );
  }

  @HttpCode(200)
  @Post('chains/:chainId/delegates')
  async postDelegate(
    @Param('chainId') chainId: string,
    @Body() createDelegateDto: CreateDelegateDto,
  ): Promise<unknown> {
    return this.service.postDelegate(chainId, createDelegateDto);
  }

  @Delete('chains/:chainId/delegates/:delegateAddress')
  async deleteDelegate(
    @Param('chainId') chainId: string,
    @Param('delegateAddress') delegateAddress: string,
    @Body() deleteDelegateDto: DeleteDelegateDto,
  ): Promise<unknown> {
    return this.service.deleteDelegate(
      chainId,
      delegateAddress,
      deleteDelegateDto,
    );
  }

  @Delete('chains/:chainId/safes/:safeAddress/delegates/:delegateAddress')
  async deleteSafeDelegate(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Param('delegateAddress') delegateAddress: string,
    @Body() deleteSafeDelegateRequest: DeleteSafeDelegateRequest,
  ): Promise<unknown> {
    if (safeAddress !== deleteSafeDelegateRequest.safe) {
      throw new BadRequestException();
    }

    return this.service.deleteSafeDelegate(
      chainId,
      delegateAddress,
      deleteSafeDelegateRequest,
    );
  }
}
