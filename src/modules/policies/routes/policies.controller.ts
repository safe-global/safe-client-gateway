// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
  CreatePolicyConfigurationRequestDto,
  type CreatePolicyConfigurationRequestPayload,
  CreatePolicyConfigurationRequestResponse,
  CreatePolicyConfigurationRequestSchema,
} from '@/modules/policies/routes/entities/create-policy-configuration-request.dto.entity';
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
    summary: 'Store the configurations of a delayed configuration request',
    description:
      'Stores the `Configuration[]` behind a `requestConfiguration(root)`, which publishes only the hash on-chain, so that the configurations a later `applyConfiguration` needs survive the delay. Call it before requesting the configuration on-chain: the root is recomputed from the configurations and has to match, but it is not required to exist on-chain yet. Idempotent: storing the same root again is a no-op.',
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
  @ApiBody({ type: CreatePolicyConfigurationRequestDto })
  @ApiCreatedResponse({ type: CreatePolicyConfigurationRequestResponse })
  @ApiBadRequestResponse({
    description:
      'Invalid space identifier, or the Safe holds the maximum number of stored requests',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid Safe identifier or body, or the configurations do not hash to the given root',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not a member of this space',
  })
  @ApiNotFoundResponse({ description: 'Safe not found in this space' })
  @Post('requests')
  public async createConfigurationRequest(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('safeId', new ValidationPipe(SafeIdSchema)) safeId: SafeId,
    @Body(new ValidationPipe(CreatePolicyConfigurationRequestSchema))
    payload: CreatePolicyConfigurationRequestPayload,
    @Auth() authPayload: AuthPayload,
  ): Promise<CreatePolicyConfigurationRequestResponse> {
    return await this.policiesService.createConfigurationRequest({
      spaceId,
      safeId,
      authPayload,
      payload,
    });
  }
}
