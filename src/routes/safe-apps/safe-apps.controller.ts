import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SafeApp } from './entities/safe-app.entity';
import { SafeAppsService } from './safe-apps.service';

@ApiTags('safe-apps')
@Controller({
  path: '',
  version: '1',
})
export class SafeAppsController {
  constructor(private readonly safeAppsService: SafeAppsService) {}

  @ApiOkResponse({ type: SafeApp, isArray: true })
  @Get('chains/:chainId/safe-apps')
  async getSafeApps(@Param('chainId') chainId: string): Promise<SafeApp[]> {
    return this.safeAppsService.getSafeApps(chainId);
  }
}
