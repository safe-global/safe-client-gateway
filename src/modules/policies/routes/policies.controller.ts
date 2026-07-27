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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import {
  GetActivePoliciesResponse,
  GetAvailablePoliciesResponse,
  GetPendingPoliciesResponse,
} from '@/modules/policies/routes/entities/policy.dto.entity';
import {
  type SafeId,
  SafeIdSchema,
} from '@/modules/policies/routes/entities/safe-id.entity';
import { PoliciesService } from '@/modules/policies/routes/policies.service';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('spaces')
@Controller({
  path: 'spaces/:spaceId/safes/:safeId/policies',
  version: '1',
})
@UseGuards(AuthGuard)
export class PoliciesController {
  public constructor(
    @Inject(PoliciesService)
    private readonly policiesService: PoliciesService,
  ) {}

  @ApiOperation({
    summary: 'Get the policies a Safe can configure',
    description:
      'Returns the policy types the Safe can configure on its chain, the contracts that enforce them and how many of each are already active. Unavailable policies are returned with `available: false` rather than omitted.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID the Safe belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'safeId',
    type: 'string',
    description: 'Safe identifier, `{chainId}:{safeAddress}`',
    example: '11155111:0x0000000000000000000000000000000000000000',
  })
  @ApiOkResponse({ type: GetAvailablePoliciesResponse })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid Safe identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not a member of this space',
  })
  @ApiNotFoundResponse({ description: 'Safe not found in this space' })
  @Get()
  public async getAvailablePolicies(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('safeId', new ValidationPipe(SafeIdSchema)) safeId: SafeId,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetAvailablePoliciesResponse> {
    return await this.policiesService.getAvailablePolicies({
      spaceId,
      safeId,
      authPayload,
    });
  }

  @ApiOperation({
    summary: 'Get the policies currently set on a Safe',
    description:
      'Returns the policies set on the Safe, derived from the policy events indexed by the Transaction Service. A policy configured before its guard was enabled is returned with `enabled: false`.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID the Safe belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'safeId',
    type: 'string',
    description: 'Safe identifier, `{chainId}:{safeAddress}`',
    example: '11155111:0x0000000000000000000000000000000000000000',
  })
  @ApiOkResponse({ type: GetActivePoliciesResponse })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid Safe identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not a member of this space',
  })
  @ApiNotFoundResponse({ description: 'Safe not found in this space' })
  @Get('active')
  public async getActivePolicies(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('safeId', new ValidationPipe(SafeIdSchema)) safeId: SafeId,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetActivePoliciesResponse> {
    return await this.policiesService.getActivePolicies({
      spaceId,
      safeId,
      authPayload,
    });
  }

  @ApiOperation({
    summary: 'Get the policy changes requested but not yet applied',
    description:
      'Returns the delayed configuration requests of the Safe that have not been invalidated, with the time from which `applyConfiguration` becomes valid.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID the Safe belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'safeId',
    type: 'string',
    description: 'Safe identifier, `{chainId}:{safeAddress}`',
    example: '11155111:0x0000000000000000000000000000000000000000',
  })
  @ApiOkResponse({ type: GetPendingPoliciesResponse })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid Safe identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not a member of this space',
  })
  @ApiNotFoundResponse({ description: 'Safe not found in this space' })
  @Get('pending')
  public async getPendingPolicies(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('safeId', new ValidationPipe(SafeIdSchema)) safeId: SafeId,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetPendingPoliciesResponse> {
    return await this.policiesService.getPendingPolicies({
      spaceId,
      safeId,
      authPayload,
    });
  }
}
