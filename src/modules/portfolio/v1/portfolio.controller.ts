// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';
import type { GetPortfolioDto } from '#/modules/portfolio/v1/entities/get-portfolio.dto.entity';
import { Portfolio } from '#/modules/portfolio/v1/entities/portfolio.entity';
import { GetPortfolioDtoSchema } from '#/modules/portfolio/v1/entities/schemas/get-portfolio.dto.schema';
import { PortfolioClearRateLimitGuard } from '#/modules/portfolio/v1/guards/portfolio-clear-rate-limit.guard';
import { PortfolioRouteGuard } from '#/modules/portfolio/v1/guards/portfolio-route.guard';
import { PortfolioApiService } from '#/modules/portfolio/v1/portfolio.service';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

/**
 * Portfolio controller.
 * Exposes GET /v1/portfolio/:address and DELETE /v1/portfolio/:address endpoints.
 */
@ApiTags('portfolio')
@UseGuards(PortfolioRouteGuard)
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
  @ApiOkResponse({ type: Portfolio })
  @Get('/portfolio/:address')
  public getPortfolio(
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
    });
  }

  @ApiOperation({
    summary: 'Clear portfolio cache',
    description:
      'Clears all cached Zerion portfolio data (overview, portfolio, positions) for a Safe. Repeat clears for the same Safe within a short cooldown are skipped.',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'Safe address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'chainId',
    required: true,
    type: String,
    description: 'A chain on which the address is a Safe',
    example: '1',
  })
  @ApiNoContentResponse({ description: 'Cleared, or skipped within cooldown' })
  @ApiNotFoundResponse({ description: 'The address is not a Safe on chainId' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid address or chainId' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit reached' })
  @UseGuards(PortfolioClearRateLimitGuard)
  @Delete('/portfolio/:address')
  @HttpCode(204)
  public async clearPortfolio(
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
    @Query('chainId', new ValidationPipe(ChainIdSchema))
    chainId: string,
  ): Promise<void> {
    await this.portfolioService.clearZerionCaches({ chainId, address });
  }
}
