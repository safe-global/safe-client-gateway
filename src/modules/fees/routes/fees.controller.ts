// SPDX-License-Identifier: FSL-1.1-MIT
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { FeePreviewTransactionDto } from '@/modules/fees/routes/entities/fee-preview-transaction.dto.entity';
import { FeePreviewResponse } from '@/modules/fees/routes/entities/fee-preview-response.entity';
import { FeePreviewTransactionDtoSchema } from '@/modules/fees/routes/entities/schemas/fee-preview-transaction.dto.schema';
import { FeesService } from '@/modules/fees/routes/fees.service';
import type { Address } from 'viem';

@ApiTags('fees')
@Controller({
  version: '1',
  path: 'chains/:chainId/fees',
})
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @ApiOperation({
    summary: 'Get transaction fee preview',
    description:
      'Calculates the estimated fees for executing a transaction via Pay with Safe, including gas costs, relay fees, and total costs in USD.',
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
      'Transaction data for fee calculation including recipient, value, data, operation type, gas token, and number of signatures',
  })
  @ApiOkResponse({
    type: FeePreviewResponse,
    description:
      'Fee preview with transaction data, relay cost, and pricing context',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid transaction data or Pay with Safe not available for this chain',
  })
  @HttpCode(200)
  @Post(':safeAddress/preview')
  async getFeePreview(
    @Param('chainId') chainId: string,
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
