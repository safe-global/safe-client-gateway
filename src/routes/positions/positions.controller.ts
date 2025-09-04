import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PositionsService } from '@/routes/positions/positions.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { Protocol } from '@/routes/positions/entities/protocol.entity';
import type { Address } from 'viem';

@ApiTags('positions')
@Controller({
  path: '',
  version: '1',
})
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @ApiOkResponse({ type: Protocol, isArray: true })
  @Get('chains/:chainId/safes/:safeAddress/positions/:fiatCode')
  async getPositions(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Param('fiatCode') fiatCode: string,
  ): Promise<Array<Protocol>> {
    return this.positionsService.getPositions({
      chainId,
      safeAddress,
      fiatCode,
    });
  }
}
