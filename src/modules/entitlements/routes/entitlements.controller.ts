// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { EntitlementsResponse } from '@/modules/entitlements/routes/entities/entitlements-response.entity';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';

@ApiTags('entitlements')
@Controller({
  path: 'spaces/:spaceId/entitlements',
  version: '1',
})
export class EntitlementsController {
  public constructor(
    @Inject(EntitlementsService)
    private readonly entitlementsService: EntitlementsService,
  ) {}

  @ApiOperation({
    summary: 'Get space entitlements',
    description:
      'The single source of truth for what a workspace can do: the active plan and per-feature entitlements, with quotas and usage for metered ones. Free-tier workspaces get the same contract shape.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({ type: EntitlementsResponse })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not a member of this space',
  })
  @ApiNotFoundResponse({ description: 'Space not found' })
  @UseGuards(AuthGuard)
  @Get()
  public async getEntitlements(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<EntitlementsResponse> {
    return await this.entitlementsService.getEntitlements({
      spaceId,
      authPayload,
    });
  }
}
