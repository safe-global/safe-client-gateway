import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { CreateDelegateDto } from '@/routes/delegates/entities/create-delegate.dto.entity';
import { Delegate } from '@/routes/delegates/entities/delegate.entity';
import { DelegatePage } from '@/routes/delegates/entities/delegate.page.entity';
import { GetDelegateDto } from '@/routes/delegates/entities/get-delegate.dto.entity';
import { CreateDelegateDtoSchema } from '@/routes/delegates/entities/schemas/create-delegate.dto.schema';
import { GetDelegateDtoSchema } from '@/routes/delegates/entities/schemas/get-delegate.dto.schema';
import { DelegatesV2Service } from '@/routes/delegates/v2/delegates.v2.service';
import { DeleteDelegateV2Dto } from '@/routes/delegates/v2/entities/delete-delegate.v2.dto.entity';
import { DeleteDelegateV2DtoSchema } from '@/routes/delegates/v2/entities/schemas/delete-delegate.v2.dto.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
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
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('delegates')
@Controller({ version: '2' })
export class DelegatesV2Controller {
  constructor(private readonly service: DelegatesV2Service) {}

  @ApiOkResponse({ type: DelegatePage })
  @ApiQuery({
    name: 'safe',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'delegate',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'delegator',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'label',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('chains/:chainId/delegates')
  async getDelegates(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Query(new ValidationPipe(GetDelegateDtoSchema))
    getDelegateDto: GetDelegateDto,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<Delegate>> {
    return this.service.getDelegates({
      chainId,
      routeUrl,
      getDelegateDto,
      paginationData,
    });
  }

  @HttpCode(200)
  @Post('chains/:chainId/delegates')
  async postDelegate(
    @Param('chainId') chainId: string,
    @Body(new ValidationPipe(CreateDelegateDtoSchema))
    createDelegateDto: CreateDelegateDto,
  ): Promise<void> {
    await this.service.postDelegate({ chainId, createDelegateDto });
  }

  @Delete('chains/:chainId/delegates/:delegateAddress')
  async deleteDelegate(
    @Param('chainId') chainId: string,
    @Param('delegateAddress') delegateAddress: `0x${string}`,
    @Body(new ValidationPipe(DeleteDelegateV2DtoSchema))
    deleteDelegateV2Dto: DeleteDelegateV2Dto,
  ): Promise<unknown> {
    return this.service.deleteDelegate({
      chainId,
      delegateAddress,
      deleteDelegateV2Dto: deleteDelegateV2Dto,
    });
  }
}
