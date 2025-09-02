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
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNoContentResponse,
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
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';

@ApiTags('delegates')
@Controller({
  version: '1',
})
export class DelegatesController {
  constructor(private readonly service: DelegatesService) {}

  @ApiOperation({
    deprecated: true,
    summary: 'Get delegates (deprecated)',
    description:
      'Retrieves a paginated list of delegates for a specific chain. This endpoint is deprecated, please use the v2 version instead.',
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
    description: 'Filter by Safe address',
  })
  @ApiQuery({
    name: 'delegate',
    required: false,
    type: String,
    description: 'Filter by delegate address',
  })
  @ApiQuery({
    name: 'delegator',
    required: false,
    type: String,
    description: 'Filter by delegator address',
  })
  @ApiQuery({
    name: 'label',
    required: false,
    type: String,
    description: 'Filter by delegate label',
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
    deprecated: true,
    summary: 'Create delegate (deprecated)',
    description:
      'Creates a new delegate for a specific chain. This endpoint is deprecated, please use the v2 version instead.',
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
      'Delegate creation data including Safe address, delegate address, and signature',
  })
  @ApiNoContentResponse({
    description: 'Delegate created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid delegate data or signature',
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
    deprecated: true,
    summary: 'Delete delegate (deprecated)',
    description:
      'Deletes a delegate for a specific chain and address. This endpoint is deprecated, please use the v2 version instead.',
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
    description: 'Delegate address to delete (0x prefixed hex string)',
  })
  @ApiBody({
    type: DeleteDelegateDto,
    description: 'Signature proving authorization to delete the delegate',
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
    @Param('delegateAddress', new ValidationPipe(AddressSchema))
    delegateAddress: Address,
    @Body(new ValidationPipe(DeleteDelegateDtoSchema))
    deleteDelegateDto: DeleteDelegateDto,
  ): Promise<unknown> {
    return this.service.deleteDelegate({
      chainId,
      delegateAddress,
      deleteDelegateDto,
    });
  }

  @ApiOperation({
    deprecated: true,
    summary: 'Delete Safe delegate (deprecated)',
    description:
      'Removes a delegate from a specific Safe. This endpoint is deprecated, please use the v2 version instead.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiParam({
    name: 'delegateAddress',
    type: 'string',
    description: 'Delegate address to remove (0x prefixed hex string)',
  })
  @ApiBody({
    type: DeleteSafeDelegateDto,
    description: 'Signature proving authorization to remove the delegate',
  })
  @ApiNoContentResponse({
    description: 'Safe delegate removed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid signature or unauthorized removal attempt',
  })
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
