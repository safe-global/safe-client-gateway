import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { ChartsService } from '@/routes/charts/charts.service';
import { Chart } from '@/routes/charts/entities/chart.entity';
import { ChartPeriod } from '@/domain/charts/entities/chart.entity';

@ApiTags('charts')
@Controller({
  path: '',
  version: '1',
})
export class ChartsController {
  constructor(private readonly chartsService: ChartsService) {}

  @ApiOperation({
    summary: 'Get fungible price chart',
    description:
      'Retrieves historical price chart data for a fungible asset (token) over a specified time period. Accepts human-readable asset IDs from the portfolio endpoint (e.g., "eth", "dai", "morpho").',
  })
  @ApiParam({
    name: 'fungibleId',
    type: 'string',
    description:
      'Asset identifier - use the assetId from portfolio endpoint (e.g., "eth", "dai", "weth-c02a")',
    example: 'eth',
  })
  @ApiParam({
    name: 'period',
    enum: ChartPeriod,
    description: 'Time period for the chart data',
    example: 'day',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Fiat currency code for price conversion (e.g., usd, eur)',
    example: 'usd',
  })
  @ApiOkResponse({ type: Chart })
  @Get('/charts/:fungibleId/:period')
  async getChart(
    @Param('fungibleId') fungibleId: string,
    @Param('period') period: ChartPeriod,
    @Query('currency', new DefaultValuePipe('usd')) currency: string,
  ): Promise<Chart> {
    return this.chartsService.getChart({
      fungibleId,
      period,
      currency,
    });
  }

  @ApiOperation({
    summary: 'Clear chart cache',
    description:
      'Clears the cached chart data for a specific fungible asset and period',
  })
  @ApiParam({
    name: 'fungibleId',
    type: 'string',
    description: 'Fungible asset identifier',
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
    example: 'usd',
  })
  @Delete('/charts/:fungibleId/:period')
  @HttpCode(204)
  async clearChart(
    @Param('fungibleId') fungibleId: string,
    @Param('period') period: ChartPeriod,
    @Query('currency', new DefaultValuePipe('usd')) currency: string,
  ): Promise<void> {
    await this.chartsService.clearChart({
      fungibleId,
      period,
      currency,
    });
  }
}
