import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiImplicitQuery } from '@nestjs/swagger/dist/decorators/api-implicit-query.decorator';
import { PaginationDataDecorator } from '../common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '../common/decorators/route.url.decorator';
import { Page } from '../common/entities/page.entity';
import { PaginationData } from '../common/pagination/pagination.data';
import { DelegatesService } from './delegates.service';
import { CreateDelegateDto } from './entities/create-delegate.dto.entity';
import { Delegate } from './entities/delegate.entity';
import { DelegatePage } from './entities/delegate.page.entity';
import { DeleteDelegateDto } from './entities/delete-delegate.dto.entity';
import { DeleteSafeDelegateDto } from './entities/delete-safe-delegate.dto.entity';
import { GetDelegateDto } from './entities/get-delegate.dto.entity';
import { CreateDelegateDtoValidationPipe } from './pipes/create-delegate.dto.validation.pipe';
import { DeleteDelegateDtoValidationPipe } from './pipes/delete-delegate.dto.validation.pipe';
import { DeleteSafeDelegateDtoValidationPipe } from './pipes/delete-safe-delegate.dto.validation.pipe';
import { GetDelegateDtoValidationPipe } from './pipes/get-delegate.dto.validation.pipe';

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
    @Query(GetDelegateDtoValidationPipe) getDelegateDto: GetDelegateDto,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<Delegate>> {
    return this.service.getDelegates(
      chainId,
      routeUrl,
      getDelegateDto,
      paginationData,
    );
  }

  @HttpCode(200)
  @Post('chains/:chainId/delegates')
  async postDelegate(
    @Param('chainId') chainId: string,
    @Body(CreateDelegateDtoValidationPipe) createDelegateDto: CreateDelegateDto,
  ): Promise<unknown> {
    return this.service.postDelegate(chainId, createDelegateDto);
  }

  @Delete('chains/:chainId/delegates/:delegateAddress')
  async deleteDelegate(
    @Param('chainId') chainId: string,
    @Param('delegateAddress') delegateAddress: string,
    @Body(DeleteDelegateDtoValidationPipe) deleteDelegateDto: DeleteDelegateDto,
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
    @Body(DeleteSafeDelegateDtoValidationPipe)
    deleteSafeDelegateRequest: DeleteSafeDelegateDto,
  ): Promise<unknown> {
    return this.service.deleteSafeDelegate(
      chainId,
      delegateAddress,
      deleteSafeDelegateRequest,
    );
  }
}
