import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param } from '@nestjs/common';
import { SafeState } from '@/routes/safes/entities/safe-info.entity';
import { SafesService } from '@/routes/safes/safes.service';
import { RecommendedNonce } from '@/routes/safes/entities/recommended-nonce.entity';

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

  @ApiOkResponse({ type: RecommendedNonce })
  @Get('chains/:chainId/safes/:safeAddress/recommended-nonce')
  async getRecommendedNonce(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
  ): Promise<RecommendedNonce> {
    return this.service.getRecommendedNonce({ chainId, safeAddress });
  }
}
