import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param } from '@nestjs/common';
import { SafesService } from './safes.service';
import { SafeState } from './entities/safe-info.entity';

@ApiTags('safes')
@Controller({
  version: '1',
})
export class SafesController {
  constructor(private readonly service: SafesService) {}

  @ApiOkResponse({ type: SafeState })
  @Get('chains/:chainId/safes/:safeAddress')
  async getSafe(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
  ): Promise<SafeState> {
    return this.service.getSafeInfo({ chainId, safeAddress });
  }
}
