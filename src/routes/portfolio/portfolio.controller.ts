import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
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
import { PortfolioService } from '@/routes/portfolio/portfolio.service';
import { Portfolio } from '@/routes/portfolio/entities/portfolio.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';

@ApiTags('portfolio')
@Controller({
  path: '',
  version: '1',
})
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @ApiOperation({
    summary: 'Get portfolio',
    description:
      'Retrieves the complete portfolio for an address including token balances and app positions across all supported chains.',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'Wallet address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'fiatCode',
    required: false,
    type: String,
    description: 'Fiat currency code for balance conversion (e.g., USD, EUR)',
    example: 'USD',
  })
  @ApiQuery({
    name: 'chainIds',
    required: false,
    type: String,
    description: 'Comma-separated list of chain IDs to filter by',
    example: '1,137,42161',
  })
  @ApiQuery({
    name: 'trusted',
    required: false,
    type: Boolean,
    description: 'If true, only returns trusted tokens',
    example: true,
  })
  @ApiQuery({
    name: 'excludeDust',
    required: false,
    type: Boolean,
    description: 'If true, filters out dust positions (balance < $1 USD)',
    example: true,
  })
  @ApiQuery({
    name: 'provider',
    required: false,
    type: String,
    description: 'Portfolio data provider (zerion or zapper)',
    example: 'zerion',
  })
  @ApiOkResponse({ type: Portfolio })
  @Get('/portfolios/:address')
  async getPortfolio(
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
    @Query('fiatCode', new DefaultValuePipe('USD')) fiatCode: string,
    @Query('chainIds') chainIds?: string,
    @Query('trusted', new DefaultValuePipe(true), ParseBoolPipe)
    trusted?: boolean,
    @Query('excludeDust', new DefaultValuePipe(true), ParseBoolPipe)
    excludeDust?: boolean,
    @Query('provider', new DefaultValuePipe('zerion')) provider?: string,
  ): Promise<Portfolio> {
    const chainIdArray = chainIds
      ? chainIds.split(',').map((id) => id.trim())
      : undefined;

    return this.portfolioService.getPortfolio({
      address,
      fiatCode,
      chainIds: chainIdArray,
      trusted,
      excludeDust,
      provider,
    });
  }

  @ApiOperation({
    summary: 'Clear portfolio cache',
    description: 'Clears the cached portfolio data for a specific address',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'Wallet address (0x prefixed hex string)',
  })
  @Delete('/portfolios/:address')
  @HttpCode(204)
  async clearPortfolio(
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
  ): Promise<void> {
    await this.portfolioService.clearPortfolio({ address });
  }
}
