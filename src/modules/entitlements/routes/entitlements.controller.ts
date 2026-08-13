// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { EntitlementsResponse } from '@/modules/entitlements/routes/entities/entitlements-response.entity';
import {
  UpdateSeatSelectionDto,
  UpdateSeatSelectionSchema,
} from '@/modules/entitlements/routes/entities/update-seat-selection.dto.entity';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('entitlements')
@Controller({
  path: 'spaces/:spaceId/entitlements',
  version: '1',
})
@UseGuards(AuthGuard)
export class EntitlementsController {
  public constructor(
    @Inject(EntitlementsService)
    private readonly entitlementsService: EntitlementsService,
  ) {}

  @ApiOperation({
    summary: 'Get space entitlements',
    description:
      'The single source of truth for what a workspace can do: the active plan, per-feature entitlements (with quotas and usage for metered ones) and the Safes currently over the seat quota. Free-tier workspaces get the same contract shape.',
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

  @ApiOperation({
    summary: 'Select the Safes covered by the plan seats',
    description:
      'Replaces the workspace admin’s explicit choice of which Safes keep the covered seats while the workspace is over its seat quota. Selecting fewer Safes than the quota tops the remainder up oldest-first; an empty list restores the default (oldest-first) coverage.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateSeatSelectionDto })
  @ApiOkResponse({
    type: EntitlementsResponse,
    description: 'The recomputed entitlements after applying the selection',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid space identifier, unlimited seats (selection not applicable) or more Safes selected than the quota allows',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not an admin of this space',
  })
  @ApiNotFoundResponse({ description: 'Space not found' })
  @ApiConflictResponse({
    description: 'Seat selection does not apply to grandfathered workspaces',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Some of the selected Safes do not belong to this workspace',
  })
  @Put('/seat-selection')
  public async updateSeatSelection(
    @Body(new ValidationPipe(UpdateSeatSelectionSchema))
    body: UpdateSeatSelectionDto,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<EntitlementsResponse> {
    return await this.entitlementsService.updateSeatSelection({
      spaceId,
      authPayload,
      payload: body,
    });
  }
}
