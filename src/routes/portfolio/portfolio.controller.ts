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
import { ChainIdsSchema } from '@/routes/portfolio/entities/schemas/chain-ids.schema';
import { ProviderValidationPipe } from '@/routes/portfolio/pipes/provider-validation.pipe';
import { PortfolioProvider } from '@/domain/portfolio/entities/portfolio-provider.enum';
import { WalletChart } from '@/routes/portfolio/entities/wallet-chart.entity';
import { ChartPeriod } from '@/domain/charts/entities/chart.entity';
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
    description:
      'Comma-separated list of chain IDs to filter by. If omitted, returns data for all chains.',
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
    enum: PortfolioProvider,
    description: 'Portfolio data provider',
    example: PortfolioProvider.ZERION,
  })
  @ApiOkResponse({ type: Portfolio })
  @Get('/portfolio/:address')
  async getPortfolio(
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
    @Query('fiatCode', new DefaultValuePipe('USD')) fiatCode: string,
    @Query('chainIds', new ValidationPipe(ChainIdsSchema))
    chainIds?: Array<string>,
    @Query('trusted', new DefaultValuePipe(true), ParseBoolPipe)
    trusted?: boolean,
    @Query('excludeDust', new DefaultValuePipe(true), ParseBoolPipe)
    excludeDust?: boolean,
    @Query(
      'provider',
      new DefaultValuePipe(PortfolioProvider.ZERION),
      ProviderValidationPipe,
    )
    provider?: PortfolioProvider,
  ): Promise<Portfolio> {
    return this.portfolioService.getPortfolio({
      address,
      fiatCode,
      chainIds,
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
  @Delete('/portfolio/:address')
  @HttpCode(204)
  async clearPortfolio(
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
  ): Promise<void> {
    await this.portfolioService.clearPortfolio({ address });
  }

  @ApiOperation({
    summary: 'Get wallet chart',
    description:
      'Retrieves historical portfolio value chart data for a wallet address over a specified time period.',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'Wallet address (0x prefixed hex string)',
  })
  @ApiParam({
    name: 'period',
    enum: ChartPeriod,
    description: 'Time period for the chart data',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Fiat currency code for value conversion (e.g., USD, EUR)',
    example: 'USD',
  })
  @ApiOkResponse({ type: WalletChart })
  @Get('/portfolio/:address/chart/:period')
  async getWalletChart(
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
    @Param('period') period: ChartPeriod,
    @Query('currency', new DefaultValuePipe('USD')) currency: string,
  ): Promise<WalletChart> {
    return this.portfolioService.getWalletChart({
      address,
      period,
      currency,
    });
  }

  @ApiOperation({
    summary: 'Clear wallet chart cache',
    description:
      'Clears the cached wallet chart data for a specific address and period',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'Wallet address (0x prefixed hex string)',
  })
  @ApiParam({
    name: 'period',
    enum: ChartPeriod,
    description: 'Time period',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Fiat currency code',
    example: 'USD',
  })
  @Delete('/portfolio/:address/chart/:period')
  @HttpCode(204)
  async clearWalletChart(
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
    @Param('period') period: ChartPeriod,
    @Query('currency', new DefaultValuePipe('USD')) currency: string,
  ): Promise<void> {
    await this.portfolioService.clearWalletChart({
      address,
      period,
      currency,
    });
  }
}
