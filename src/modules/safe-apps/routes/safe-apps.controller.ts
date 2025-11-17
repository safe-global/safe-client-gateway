import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SafeApp } from '@/modules/safe-apps/routes/entities/safe-app.entity';
import { SafeAppsService } from '@/modules/safe-apps/routes/safe-apps.service';

@ApiTags('safe-apps')
@Controller({
  path: '',
  version: '1',
})
export class SafeAppsController {
  constructor(private readonly safeAppsService: SafeAppsService) {}

  @ApiOperation({
    summary: 'Get Safe Apps',
    description:
      'Retrieves a list of Safe Apps available for a specific chain, with optional filtering by client URL or app URL.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID to get Safe Apps for',
    example: '1',
  })
  @ApiQuery({
    name: 'clientUrl',
    required: false,
    type: String,
    description:
      'Filter by client URL to get apps compatible with specific client',
  })
  @ApiQuery({
    name: 'url',
    required: false,
    type: String,
    description: 'Filter by specific Safe App URL',
  })
  @ApiOkResponse({
    type: SafeApp,
    isArray: true,
    description: 'List of Safe Apps available for the specified chain',
  })
  @Get('chains/:chainId/safe-apps')
  async getSafeApps(
    @Param('chainId') chainId: string,
    @Query('clientUrl') clientUrl?: string,
    @Query('url') url?: string,
  ): Promise<Array<SafeApp>> {
    return this.safeAppsService.getSafeApps({ chainId, clientUrl, url });
  }
}
