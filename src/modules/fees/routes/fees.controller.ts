// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import { FeePreviewResponse } from '#/modules/fees/routes/entities/fee-preview-response.entity';
import { FeePreviewTransactionDto } from '#/modules/fees/routes/entities/fee-preview-transaction.dto.entity';
import { GasToken } from '#/modules/fees/routes/entities/gas-token.entity';
import { GasTokenPage } from '#/modules/fees/routes/entities/gas-token-page.entity';
import { FeePreviewTransactionDtoSchema } from '#/modules/fees/routes/entities/schemas/fee-preview-transaction.dto.schema';
import { FeesService } from '#/modules/fees/routes/fees.service';
import { RouteUrlDecorator } from '#/routes/common/decorators/route.url.decorator';
import type { Page } from '#/routes/common/entities/page.entity';
import type { PaginationData } from '#/routes/common/pagination/pagination.data';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '#/validation/entities/schemas/numeric-string.schema';
import { PaginationCursorSchema } from '#/validation/entities/schemas/pagination-cursor.schema';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

@ApiTags('fees')
@Controller({
  version: '1',
  path: 'chains/:chainId/fees',
})
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @ApiOperation({
    summary: 'Get supported gas tokens',
    description:
      'Retrieves a paginated list of gas tokens supported for Pay with Safe on the given chain, ordered by selection priority.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiOkResponse({
    type: GasTokenPage,
    description: 'Paginated list of supported gas tokens, ordered by priority',
  })
  @ApiUnprocessableEntityResponse({ description: 'Invalid cursor' })
  @Get('gas-tokens')
  getGasTokens(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Query('cursor', new ValidationPipe(PaginationCursorSchema))
    paginationData: PaginationData,
  ): Promise<Page<GasToken>> {
    return this.feesService.getGasTokens(routeUrl, chainId, paginationData);
  }

  @ApiOperation({
    summary: 'Get transaction fee preview',
    description:
      'Calculates the estimated fees for executing a transaction via Pay with Safe. The fee model applied is selected internally per-chain and is transparent to the caller.',
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
  @ApiBody({
    type: FeePreviewTransactionDto,
    description:
      'Transaction data for fee calculation including recipient, value, data, operation type, nonce, gas token, and number of signatures',
  })
  @ApiOkResponse({
    type: FeePreviewResponse,
    description:
      'Fee preview with transaction data plus, depending on the fee model applied for the chain, either a relay cost or a fee breakdown',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid transaction data or Pay with Safe not available for this chain',
  })
  @HttpCode(200)
  @Post(':safeAddress/preview')
  getFeePreview(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(FeePreviewTransactionDtoSchema))
    feePreviewDto: FeePreviewTransactionDto,
  ): Promise<FeePreviewResponse> {
    return this.feesService.getFeePreview({
      chainId,
      safeAddress,
      feePreviewDto,
    });
  }
}
