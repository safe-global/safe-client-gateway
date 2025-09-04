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
import {
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import type { Address } from 'viem';

@ApiTags('delegates')
@Controller({ version: '2' })
export class DelegatesV2Controller {
  constructor(private readonly service: DelegatesV2Service) {}

  @ApiOperation({
    summary: 'Get delegates',
    description:
      'Retrieves a paginated list of delegates for a specific chain with optional filtering by Safe, delegate, delegator, or label.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where delegates are registered',
    example: '1',
  })
  @ApiQuery({
    name: 'safe',
    required: false,
    type: String,
    description: 'Filter by Safe address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'delegate',
    required: false,
    type: String,
    description: 'Filter by delegate address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'delegator',
    required: false,
    type: String,
    description: 'Filter by delegator address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'label',
    required: false,
    type: String,
    description: 'Filter by delegate label or name',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiOkResponse({
    type: DelegatePage,
    description: 'Paginated list of delegates retrieved successfully',
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

  @ApiOperation({
    summary: 'Create delegate',
    description:
      'Creates a new delegate relationship between a Safe and a delegate address. Requires proper authorization signature.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the delegate will be registered',
    example: '1',
  })
  @ApiBody({
    type: CreateDelegateDto,
    description:
      'Delegate creation data including Safe address, delegate address, label, and authorization signature',
  })
  @ApiNoContentResponse({
    description: 'Delegate created successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid delegate data, signature, or unauthorized creation attempt',
  })
  @HttpCode(200)
  @Post('chains/:chainId/delegates')
  async postDelegate(
    @Param('chainId') chainId: string,
    @Body(new ValidationPipe(CreateDelegateDtoSchema))
    createDelegateDto: CreateDelegateDto,
  ): Promise<void> {
    await this.service.postDelegate({ chainId, createDelegateDto });
  }

  @ApiOperation({
    summary: 'Delete delegate',
    description:
      'Removes a delegate relationship for a specific delegate address. Requires proper authorization signature.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the delegate is registered',
    example: '1',
  })
  @ApiParam({
    name: 'delegateAddress',
    type: 'string',
    description: 'Delegate address to remove (0x prefixed hex string)',
  })
  @ApiBody({
    type: DeleteDelegateV2Dto,
    description:
      'Signature and data proving authorization to delete the delegate',
  })
  @ApiNoContentResponse({
    description: 'Delegate deleted successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid signature or unauthorized deletion attempt',
  })
  @Delete('chains/:chainId/delegates/:delegateAddress')
  async deleteDelegate(
    @Param('chainId') chainId: string,
    @Param('delegateAddress') delegateAddress: Address,
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
