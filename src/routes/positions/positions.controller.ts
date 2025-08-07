import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PositionsService } from '@/routes/positions/positions.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { Positions } from '@/routes/positions/entities/positions.entity';

@ApiTags('positions')
@Controller({
  path: '',
  version: '1',
})
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @ApiOkResponse({ type: Positions })
  @Get('chains/:chainId/safes/:safeAddress/positions/:fiatCode')
  async getPositions(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Param('fiatCode') fiatCode: string,
  ): Promise<Positions> {
    return this.positionsService.getPositions({
      chainId,
      safeAddress,
      fiatCode,
    });
  }
}
