// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { GetSpaceActivePoliciesPage } from '@/modules/policies/routes/entities/policy.dto.entity';
import {
  type SafeIds,
  SafeIdsSchema,
} from '@/modules/policies/routes/entities/safe-id.entity';
import { PoliciesService } from '@/modules/policies/routes/policies.service';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

/**
 * Policies across every Safe of a Space.
 *
 * The Policies page renders all of them at once, so this exists to keep the
 * request count from growing with the size of the Space: one indexer read covers
 * every Safe, on every chain.
 */
@ApiTags('spaces')
@Controller({
  path: 'spaces/:spaceId/policies',
  version: '1',
})
@UseGuards(AuthGuard)
export class SpacePoliciesController {
  public constructor(
    @Inject(PoliciesService)
    private readonly policiesService: PoliciesService,
  ) {}

  @ApiOperation({
    summary: 'Get the policies in effect across a Space',
    description:
      'Returns the policies of every Safe in the Space, each item carrying the Safe it applies to so nothing merges across chains. All of them load or the request fails - a partial list would report a Safe as unrestricted when its state is merely unknown.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'safes',
    required: false,
    description:
      "Narrow the read to a subset of the Space's Safes, comma-separated as `{chainId}:{safeAddress}`",
    example: '11155111:0x0000000000000000000000000000000000000000',
  })
  @ApiOkResponse({ type: GetSpaceActivePoliciesPage })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid Safe identifier, or a Safe outside this space',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not a member of this space',
  })
  @Get('active')
  public async getActivePolicies(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Auth() authPayload: AuthPayload,
    @Query('safes', new ValidationPipe(SafeIdsSchema.optional()))
    safes?: SafeIds,
  ): Promise<GetSpaceActivePoliciesPage> {
    return await this.policiesService.getSpaceActivePolicies({
      spaceId,
      safes,
      authPayload,
    });
  }
}
