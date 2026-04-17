// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Address } from 'viem';
import { Protocol } from '@/modules/positions/routes/entities/protocol.entity';
import type { PositionsService } from '@/modules/positions/routes/positions.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

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
  getPositions(
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
