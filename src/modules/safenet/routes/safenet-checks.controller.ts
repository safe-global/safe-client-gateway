// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';
import {
  CreateSafenetCheckDto,
  CreateSafenetCheckDtoSchema,
} from '#/modules/safenet/routes/entities/safenet-check.dto.entity';
import { SafenetChecksService } from '#/modules/safenet/routes/safenet-checks.service';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { Auth } from '#/routes/common/auth/auth.decorator';
import { SpaceIdPipe } from '#/routes/common/pipes/space-id.pipe';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

@ApiTags('safenet')
@Controller({
  version: '1',
  path: 'spaces/:spaceId/chains/:chainId/safes/:safeAddress/safenet/checks',
})
export class SafenetChecksController {
  constructor(private readonly safenetChecksService: SafenetChecksService) {}

  @ApiOperation({
    summary: 'Request a Safenet check at a workspace expense',
    description:
      'Queues a Safenet check of a pending Safe transaction that an owner has signed. ' +
      'Safe Labs pays the fee and counts the check against the workspace in the path. ' +
      'The caller must be an active member of that workspace, the workspace must hold the ' +
      'Safe and have a plan that includes Safenet checks, and the chain must list SAFENET_CHECKS.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: CreateSafenetCheckDto })
  @ApiAcceptedResponse({ description: 'Queued, or already queued' })
  @ApiBadRequestResponse({ description: 'Malformed workspace identifier' })
  @ApiForbiddenResponse({
    description:
      'Not a member of the workspace, or the workspace does not hold the Safe or its plan does not include checks',
  })
  @ApiNotFoundResponse({
    description: 'Workspace not found, or no such transaction for this Safe',
  })
  @ApiTooManyRequestsResponse({
    description:
      'The workspace has used its daily limit of sponsored Safenet checks',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiUnprocessableEntityResponse({
    description:
      'The Safe is older than 1.3.0, or the transaction is executed or stale, unsigned by an owner, or of another Safe',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Safenet checks are not available on this chain',
  })
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthGuard)
  public async requestCheck(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId') spaceUuid: Space['uuid'],
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(CreateSafenetCheckDtoSchema))
    body: CreateSafenetCheckDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    await this.safenetChecksService.requestCheck({
      space: { id: spaceId, uuid: spaceUuid },
      chainId,
      safeAddress,
      safeTxHash: body.safeTxHash,
      authPayload,
    });
  }
}
