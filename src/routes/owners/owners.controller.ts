import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SafeList } from './entities/safe-list.entity';
import { OwnersService } from './owners.service';

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
    @Param('ownerAddress') ownerAddress: string,
  ): Promise<SafeList> {
    return this.ownersService.getSafesByOwner(chainId, ownerAddress);
  }
}
