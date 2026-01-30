import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { PortfolioApiService } from '@/modules/portfolio/v1/portfolio.service';
import { Portfolio } from '@/modules/portfolio/v1/entities/portfolio.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { GetPortfolioDto } from '@/modules/portfolio/v1/entities/get-portfolio.dto.entity';
import { GetPortfolioDtoSchema } from '@/modules/portfolio/v1/entities/schemas/get-portfolio.dto.schema';
import { PortfolioCacheHeadersInterceptor } from '@/modules/portfolio/v1/interceptors/portfolio-cache-headers.interceptor';
import type { Address } from 'viem';

/**
 * Portfolio controller.
 * Exposes GET /v1/portfolio/:address and DELETE /v1/portfolio/:address endpoints.
 */
@ApiTags('portfolio')
@Controller({
  path: '',
  version: '1',
})
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioApiService) {}

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
    description: 'If true, filters out dust positions (balance < $0.001 USD)',
    example: true,
  })
  @ApiQuery({
    name: 'sync',
    required: false,
    type: Boolean,
    description:
      'If true, waits for position data to be aggregated before responding (up to 30s)',
    example: false,
  })
  @ApiHeader({
    name: 'Cache-Control',
    description:
      'Cache directive with max-age in seconds (e.g., public, max-age=30)',
  })
  @ApiHeader({
    name: 'Age',
    description: 'Age of the cached response in seconds',
  })
  @ApiHeader({
    name: 'X-Cache-Status',
    description:
      'Cache status: HIT if served from cache, MISS if freshly fetched',
  })
  @ApiHeader({
    name: 'X-Cache-TTL',
    description: 'Remaining cache time-to-live in seconds',
  })
  @ApiOkResponse({ type: Portfolio })
  @UseInterceptors(PortfolioCacheHeadersInterceptor)
  @Get('/portfolio/:address')
  public async getPortfolio(
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
    @Query(new ValidationPipe(GetPortfolioDtoSchema))
    getPortfolioDto: GetPortfolioDto,
  ): Promise<Portfolio> {
    return this.portfolioService.getPortfolio({
      address,
      fiatCode: getPortfolioDto.fiatCode,
      chainIds: getPortfolioDto.chainIds,
      trusted: getPortfolioDto.trusted,
      excludeDust: getPortfolioDto.excludeDust,
      sync: getPortfolioDto.sync,
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
  public async clearPortfolio(
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
  ): Promise<void> {
    await this.portfolioService.clearPortfolio({ address });
  }
}
