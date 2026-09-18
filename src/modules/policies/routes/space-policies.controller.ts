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
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { ActivePolicyDto } from '@/modules/policies/routes/entities/policy.dto.entity';
import { PoliciesService } from '@/modules/policies/routes/policies.service';
import { Auth } from '@/routes/common/auth/auth.decorator';
import { SpaceIdPipe } from '@/routes/common/pipes/space-id.pipe';
import {
  type Caip10Addresses,
  Caip10AddressesSchema,
} from '@/validation/entities/schemas/caip-10-addresses.schema';
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
    summary: 'Get the active policies on Safes in a Space',
    description:
      'Returns the policies of every Safe in the Space. All of them load or the request fails.',
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
  @ApiOkResponse({ type: ActivePolicyDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid CAIP-10 address, or a Safe outside this space',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - authentication missing or invalid, or user is not a member of this space',
  })
  @ApiServiceUnavailableResponse({
    description: 'The policy api is unavailable',
  })
  @Get('active')
  public async getActivePolicies(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Auth() authPayload: AuthPayload,
    @Query('safes', new ValidationPipe(Caip10AddressesSchema.optional()))
    safes?: Caip10Addresses,
  ): Promise<Array<ActivePolicyDto>> {
    return await this.policiesService.getSpaceActivePolicies({
      spaceId,
      safes,
      authPayload,
    });
  }
}
