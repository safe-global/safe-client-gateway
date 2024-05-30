import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SafeList } from '@/routes/owners/entities/safe-list.entity';
import { OwnersService } from '@/routes/owners/owners.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

@ApiTags('owners')
@Controller({
  path: '',
  version: '1',
})
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @ApiOkResponse({ type: SafeList })
  @Get('chains/:chainId/owners/:ownerAddress/safes')
  async getSafesByOwner(
    @Param('chainId') chainId: string,
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: `0x${string}`,
  ): Promise<SafeList> {
    return this.ownersService.getSafesByOwner({ chainId, ownerAddress });
  }

  @ApiOkResponse({ type: SafeList })
  @Get('owners/:ownerAddress/safes')
  async getAllSafesByOwner(
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: `0x${string}`,
  ): Promise<{ [chainId: string]: Array<string> }> {
    return this.ownersService.getAllSafesByOwner({ ownerAddress });
  }
}
