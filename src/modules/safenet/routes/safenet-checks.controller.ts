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
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
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
import { Auth } from '#/routes/common/auth/auth.decorator';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

@ApiTags('safenet')
@Controller({
  version: '1',
  path: 'chains/:chainId/safes/:safeAddress/safenet/checks',
})
export class SafenetChecksController {
  constructor(private readonly safenetChecksService: SafenetChecksService) {}

  @ApiOperation({
    summary: 'Request a sponsored Safenet check',
    description:
      'Queues a Safenet check of a pending Safe transaction that an owner has signed. ' +
      'Safe Labs pays the fee. The chain must list SAFENET_CHECKS, and a workspace of the ' +
      'caller that holds the Safe must have a plan that includes Safenet checks.',
  })
  @ApiBody({ type: CreateSafenetCheckDto })
  @ApiAcceptedResponse({ description: 'Queued, or already queued' })
  @ApiForbiddenResponse({
    description:
      'Checks are not available on this chain, or no workspace of the caller qualifies',
  })
  @ApiNotFoundResponse({ description: 'No such transaction for this Safe' })
  @ApiTooManyRequestsResponse({
    description:
      'The workspace has used its daily limit of sponsored Safenet checks',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiUnprocessableEntityResponse({
    description:
      'The Safe is older than 1.3.0, or the transaction is executed or stale, unsigned by an owner, or of another Safe',
  })
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthGuard)
  public async requestCheck(
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(CreateSafenetCheckDtoSchema))
    body: CreateSafenetCheckDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    await this.safenetChecksService.requestCheck({
      chainId,
      safeAddress,
      safeTxHash: body.safeTxHash,
      authPayload,
    });
  }
}
