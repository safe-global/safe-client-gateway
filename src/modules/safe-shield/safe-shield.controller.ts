import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';
import { SafeShieldService } from './safe-shield.service';
import type { GroupedAnalysisResults } from './entities/analysis-responses.entity';
import type { RecipientAnalysisResult } from './entities/analysis-result.entity';

/**
 * Controller for Safe Shield security analysis endpoints.
 *
 * Provides real-time security analysis for transactions, including recipients and contracts
 * to help users make informed decisions about their transactions.
 */
@ApiTags('safe-shield')
@Controller({
  path: '',
  version: '1',
})
export class SafeShieldController {
  constructor(private readonly safeShieldService: SafeShieldService) {}

  @ApiOperation({
    summary: 'Analyze recipient address',
    description:
      'Performs real-time security analysis of a recipient address for a specific Safe. ' +
      'Returns analysis results grouped by status group, sorted by severity (CRITICAL first).',
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
    description: 'Safe contract address',
  })
  @ApiParam({
    name: 'recipientAddress',
    type: 'string',
    description: 'Recipient address to analyze',
  })
  @ApiOkResponse({
    description: 'Recipient analysis results grouped by status group',
  })
  @HttpCode(HttpStatus.OK)
  @Get('chains/:chainId/security/:safeAddress/recipient/:recipientAddress')
  async analyzeRecipient(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Param('recipientAddress', new ValidationPipe(AddressSchema))
    recipientAddress: Address,
  ): Promise<GroupedAnalysisResults<RecipientAnalysisResult>> {
    return await this.safeShieldService.analyzeRecipient({
      chainId,
      safeAddress,
      recipientAddress,
    });
  }
}
