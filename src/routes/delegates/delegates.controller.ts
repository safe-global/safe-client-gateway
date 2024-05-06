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
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { DelegatesService } from '@/routes/delegates/delegates.service';
import { CreateDelegateDto } from '@/routes/delegates/entities/create-delegate.dto.entity';
import { Delegate } from '@/routes/delegates/entities/delegate.entity';
import { DelegatePage } from '@/routes/delegates/entities/delegate.page.entity';
import { DeleteDelegateDto } from '@/routes/delegates/entities/delete-delegate.dto.entity';
import { DeleteSafeDelegateDto } from '@/routes/delegates/entities/delete-safe-delegate.dto.entity';
import { GetDelegateDto } from '@/routes/delegates/entities/get-delegate.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { GetDelegateDtoSchema } from '@/routes/delegates/entities/schemas/get-delegate.dto.schema';
import { CreateDelegateDtoSchema } from '@/routes/delegates/entities/schemas/create-delegate.dto.schema';
import { DeleteDelegateDtoSchema } from '@/routes/delegates/entities/schemas/delete-delegate.dto.schema';
import { DeleteSafeDelegateDtoSchema } from '@/routes/delegates/entities/schemas/delete-safe-delegate.dto.schema';

@ApiTags('delegates')
@Controller({
  version: '1',
})
export class DelegatesController {
  constructor(private readonly service: DelegatesService) {}

  @ApiOperation({ deprecated: true })
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

  @ApiOperation({ deprecated: true })
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
    @Param('delegateAddress') delegateAddress: string,
    @Body(new ValidationPipe(DeleteDelegateDtoSchema))
    deleteDelegateDto: DeleteDelegateDto,
  ): Promise<unknown> {
    return this.service.deleteDelegate({
      chainId,
      delegateAddress,
      deleteDelegateDto,
    });
  }

  @Delete('chains/:chainId/safes/:safeAddress/delegates/:delegateAddress')
  async deleteSafeDelegate(
    @Param('chainId') chainId: string,
    @Body(new ValidationPipe(DeleteSafeDelegateDtoSchema))
    deleteSafeDelegateRequest: DeleteSafeDelegateDto,
  ): Promise<unknown> {
    return this.service.deleteSafeDelegate({
      chainId,
      deleteSafeDelegateRequest,
    });
  }
}
