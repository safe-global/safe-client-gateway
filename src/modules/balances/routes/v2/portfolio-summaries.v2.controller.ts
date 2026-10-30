// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { PortfolioSummariesRateLimitGuard } from '#/modules/balances/routes/guards/portfolio-summaries-rate-limit.guard';
import { FiatCodeSchema } from '#/modules/balances/routes/v2/entities/fiat-code.schema';
import { PortfolioSummary } from '#/modules/balances/routes/v2/entities/portfolio-summary.entity';
import { PortfolioSummariesV2Service } from '#/modules/balances/routes/v2/portfolio-summaries.v2.service';
import { BooleanStringSchema } from '#/validation/entities/schemas/boolean-string.schema';
import {
  type Caip10Addresses,
  Caip10AddressesSchema,
} from '#/validation/entities/schemas/caip-10-addresses.schema';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

@ApiTags('portfolio')
@Controller({ path: 'portfolio', version: '2' })
export class PortfolioSummariesV2Controller {
  constructor(private readonly service: PortfolioSummariesV2Service) {}

  @ApiOperation({
    summary: 'Get portfolio summaries',
    description:
      'Returns the fiat value of each Safe, read from one cached Zerion snapshot per wallet on Zerion-supported chains and from the Transaction Service elsewhere. Safes that cannot be resolved are left out of the response.',
  })
  @ApiQuery({
    name: 'safes',
    required: true,
    type: String,
    description:
      'Comma-separated list of Safe addresses in chainId:address format. Only the first MAX_SAFE_OVERVIEWS distinct entries are used.',
    example:
      '1:0x1234567890123456789012345678901234567890,137:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  })
  @ApiQuery({
    name: 'currency',
    required: true,
    type: String,
    description: 'Fiat currency code (e.g. USD, EUR)',
    example: 'USD',
  })
  @ApiQuery({
    name: 'trusted',
    required: false,
    type: Boolean,
    description: 'If true, only trusted tokens count. Defaults to false.',
    example: false,
  })
  @ApiOkResponse({ type: PortfolioSummary, isArray: true })
  @ApiBadRequestResponse({ description: 'Unsupported currency' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid query parameters' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit reached' })
  @UseGuards(PortfolioSummariesRateLimitGuard)
  @Get('summaries')
  getSummaries(
    @Query('safes', new ValidationPipe(Caip10AddressesSchema))
    safes: Caip10Addresses,
    @Query('currency', new ValidationPipe(FiatCodeSchema))
    currency: string,
    @Query('trusted', new ValidationPipe(BooleanStringSchema.optional()))
    trusted?: boolean,
  ): Promise<Array<PortfolioSummary>> {
    return this.service.getSummaries({
      safes,
      currency,
      trusted: trusted ?? false,
    });
  }
}
