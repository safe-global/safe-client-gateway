import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';
import { SafeShieldService } from './safe-shield.service';
import { RecipientInteractionAnalysisDto } from './entities/dtos/recipient-analysis.dto';
import type {
  CounterpartyAnalysisResponse,
} from './entities/analysis-responses.entity';
import {
  CounterpartyAnalysisRequestDto,
  CounterpartyAnalysisRequestSchema,
} from './entities/analysis-requests.entity';

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
    description: 'Recipient interaction analysis results',
    type: RecipientInteractionAnalysisDto,
  })
  @HttpCode(HttpStatus.OK)
  @Get('chains/:chainId/security/:safeAddress/recipient/:recipientAddress')
  async analyzeRecipient(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Param('recipientAddress', new ValidationPipe(AddressSchema))
    recipientAddress: Address,
  ): Promise<RecipientInteractionAnalysisDto> {
    return await this.safeShieldService.analyzeRecipient({
      chainId,
      safeAddress,
      recipientAddress,
  });
  }

  @ApiOperation({
    summary: 'Analyze transaction counterparties',
    description:
      'Performs combined contract and recipient analysis for a Safe transaction. ' +
      'Returns both analyses grouped by status group for each counterparty.',
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
  @ApiBody({
    type: CounterpartyAnalysisRequestDto,
    required: true,
    description:
      'Transaction data used to analyze all counterparties involved.',
  })
  @ApiOkResponse({
    description:
      'Combined counterparty analysis including recipients and contracts grouped by status group.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('chains/:chainId/security/:safeAddress/counterparty-analysis')
  async analyzeCounterparty(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(CounterpartyAnalysisRequestSchema))
    txData: CounterpartyAnalysisRequestDto,
  ): Promise<CounterpartyAnalysisResponse> {
    return await this.safeShieldService.analyzeCounterparty({
      chainId,
      safeAddress,
      tx: txData,
    });
  }
}
