// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import {
  EntitlementsResponse,
  type SpacesEntitlementsResponse,
} from '@/modules/entitlements/routes/entities/entitlements-response.entity';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { Auth } from '@/routes/common/auth/auth.decorator';
import { SpaceIdPipe } from '@/routes/common/pipes/space-id.pipe';

@ApiTags('entitlements')
@Controller({
  path: 'spaces',
  version: '1',
})
export class EntitlementsController {
  public constructor(
    @Inject(EntitlementsService)
    private readonly entitlementsService: EntitlementsService,
  ) {}

  @ApiOperation({
    summary: 'Get entitlements of all spaces',
    description:
      'The entitlements of every workspace the user is an active member of, keyed by workspace UUID. Each value is what the per-workspace endpoint returns.',
  })
  @ApiExtraModels(EntitlementsResponse)
  @ApiOkResponse({
    schema: {
      type: 'object',
      additionalProperties: { $ref: getSchemaPath(EntitlementsResponse) },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Access forbidden - missing or invalid authentication',
  })
  @UseGuards(AuthGuard)
  @Get('entitlements')
  public async getAllEntitlements(
    @Auth() authPayload: AuthPayload,
  ): Promise<SpacesEntitlementsResponse> {
    return await this.entitlementsService.getAllEntitlements(authPayload);
  }

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
  @Get(':spaceId/entitlements')
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
