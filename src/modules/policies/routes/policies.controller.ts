// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';
import {
  CreatePolicyConfigurationRequestDto,
  type CreatePolicyConfigurationRequestPayload,
  CreatePolicyConfigurationRequestResponse,
  CreatePolicyConfigurationRequestSchema,
  PolicyConfigurationRootSchema,
} from '#/modules/policies/routes/entities/create-policy-configuration-request.dto.entity';
import { PolicyConfigurationRequestsService } from '#/modules/policies/routes/policy-configuration-requests.service';
import { Auth } from '#/routes/common/auth/auth.decorator';
import { SpaceIdPipe } from '#/routes/common/pipes/space-id.pipe';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

@ApiTags('spaces')
@Controller({
  path: 'spaces/:spaceId/chains/:chainId/safes/:safeAddress/policies',
  version: '1',
})
@UseGuards(AuthGuard)
export class PoliciesController {
  public constructor(
    @Inject(PolicyConfigurationRequestsService)
    private readonly configurationRequestsService: PolicyConfigurationRequestsService,
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
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '11155111',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address, must be registered to the Space',
  })
  @ApiBody({ type: CreatePolicyConfigurationRequestDto })
  @ApiCreatedResponse({ type: CreatePolicyConfigurationRequestResponse })
  @ApiBadRequestResponse({
    description:
      'Invalid space identifier, or the Safe holds the maximum number of stored requests in this space',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid chain ID, Safe address or body, or the configurations do not hash to the given root',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not a member of this space, or the Safe is not in it',
  })
  @Post('requests')
  public async createConfigurationRequest(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(CreatePolicyConfigurationRequestSchema))
    payload: CreatePolicyConfigurationRequestPayload,
    @Auth() authPayload: AuthPayload,
  ): Promise<CreatePolicyConfigurationRequestResponse> {
    return await this.configurationRequestsService.create({
      spaceId,
      safe: { chainId, address: safeAddress },
      authPayload,
      payload,
    });
  }

  @ApiOperation({
    summary: 'Delete a draft configuration request',
    description:
      'Deletes the configurations stored behind a root the Safe has not requested on-chain. A root that exists on-chain or is requested by a queued `requestConfiguration` is not a draft and cannot be deleted here.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID the Safe belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '11155111',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address, must be registered to the Space',
  })
  @ApiParam({
    name: 'root',
    type: 'string',
    description: 'The stored configuration root, a 32-byte hex',
  })
  @ApiNoContentResponse({ description: 'Draft deleted' })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid chain ID, Safe address or root',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not a member of this space, or the Safe is not in it',
  })
  @ApiNotFoundResponse({
    description: 'No configuration request is stored for this root',
  })
  @ApiConflictResponse({
    description: 'The root exists on-chain or a queued transaction requests it',
  })
  @Delete('requests/:root')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteConfigurationRequest(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Param('root', new ValidationPipe(PolicyConfigurationRootSchema)) root: Hex,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    await this.configurationRequestsService.delete({
      spaceId,
      safe: { chainId, address: safeAddress },
      authPayload,
      root,
    });
  }
}
