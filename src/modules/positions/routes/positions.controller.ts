import {
  Controller,
  Get,
  Param,
  Query,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { PositionsService } from '@/modules/positions/routes/positions.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { Protocol } from '@/modules/positions/routes/entities/protocol.entity';
import type { Address } from 'viem';

@ApiTags('positions')
@Controller({
  path: '',
  version: '1',
})
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @ApiOkResponse({ type: Protocol, isArray: true })
  @ApiQuery({
    name: 'refresh',
    required: false,
    type: Boolean,
    description:
      'Cache busting parameter. Set to true to invalidate cache and fetch fresh data from Zerion',
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
  @Get('chains/:chainId/safes/:safeAddress/positions/:fiatCode')
  async getPositions(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Param('fiatCode') fiatCode: string,
    @Query('refresh', new DefaultValuePipe(false), ParseBoolPipe)
    refresh: boolean,
    @Query('sync', new DefaultValuePipe(false), ParseBoolPipe)
    sync: boolean,
  ): Promise<Array<Protocol>> {
    return this.positionsService.getPositions({
      chainId,
      safeAddress,
      fiatCode,
      refresh,
      sync,
    });
  }
}
