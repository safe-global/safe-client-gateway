import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { BalancesService } from '@/routes/balances/balances.service';
import { Balances } from '@/routes/balances/entities/balances.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';

@ApiTags('balances')
@Controller({
  path: '',
  version: '1',
})
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @ApiOperation({
    summary: 'Get Safe balances',
    description:
      'Retrieves token balances for a Safe on a specific chain, converted to the specified fiat currency. Includes native tokens, ERC-20 tokens, and their current market values.',
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
    name: 'fiatCode',
    type: 'string',
    description: 'Fiat currency code for balance conversion (e.g., USD, EUR)',
    example: 'USD',
  })
  @ApiQuery({
    name: 'trusted',
    required: false,
    type: Boolean,
    description: 'If true, only returns balances for trusted tokens',
    example: false,
  })
  @ApiQuery({
    name: 'exclude_spam',
    required: false,
    type: Boolean,
    description: 'If true, excludes spam tokens from results',
    example: true,
  })
  @ApiOkResponse({
    type: Balances,
    description: 'Safe balances retrieved successfully with fiat conversions',
  })
  @Get('chains/:chainId/safes/:safeAddress/balances/:fiatCode')
  async getBalances(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Param('fiatCode') fiatCode: string,
    @Query('trusted', new DefaultValuePipe(false), ParseBoolPipe)
    trusted: boolean,
    @Query('exclude_spam', new DefaultValuePipe(true), ParseBoolPipe)
    excludeSpam: boolean,
  ): Promise<Balances> {
    return this.balancesService.getBalances({
      chainId,
      safeAddress,
      fiatCode,
      trusted,
      excludeSpam,
    });
  }

  @ApiOperation({
    summary: 'Get supported fiat currencies',
    description:
      'Retrieves a list of all supported fiat currency codes that can be used for balance conversions.',
  })
  @ApiOkResponse({
    type: [String],
    description:
      'List of supported fiat currency codes (e.g., ["USD", "EUR", "GBP"])',
  })
  @Get('balances/supported-fiat-codes')
  async getSupportedFiatCodes(): Promise<Array<string>> {
    return this.balancesService.getSupportedFiatCodes();
  }
}
