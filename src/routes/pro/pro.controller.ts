import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { ProService } from '@/routes/pro/pro.service';
import { CanAccessFeatureDto } from '@/routes/spaces/entities/pro.dto.entity';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

@Controller({
  version: '1',
  path: 'pro',
})
export class ProController {
  constructor(private readonly proService: ProService) {}

  // TODO: Authenticate
  @Get()
  @UseGuards(AuthGuard)
  async canAccessProFeatures(
    @Auth() authPayload: AuthPayload,
    @Query('spaceId') spaceId: number,
    @Query('feature') feature: string,
  ): Promise<CanAccessFeatureDto> {
    return this.proService.canAccessProFeatures(authPayload, spaceId, feature);
  }
}
