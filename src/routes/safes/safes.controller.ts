import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param } from '@nestjs/common';
import { SafeState } from '@/routes/safes/entities/safe-info.entity';
import { SafesService } from '@/routes/safes/safes.service';

@ApiTags('safes')
@Controller({
  version: '1',
})
export class SafesController {
  constructor(private readonly service: SafesService) {}

  @Get('chains/:chainId/safes/:safeAddress')
  async getSafe(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
  ): Promise<SafeState> {
    return this.service.getSafeInfo({ chainId, safeAddress });
  }
}
