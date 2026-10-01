// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { QuotaExceededExceptionFilter } from '@/modules/entitlements/domain/exception-filters/quota-exceeded.exception-filter';
import { RelayCalldataExceptionFilters } from '@/modules/relay/domain/exception-filters/relay-calldata.exception-filters';
import { RelayLimitReachedExceptionFilter } from '@/modules/relay/domain/exception-filters/relay-limit-reached.exception-filter';
import { SafeTxHashMismatchExceptionFilter } from '@/modules/relay/domain/exception-filters/safe-tx-hash-mismatch.exception-filter';
import { GasPaymentOptionUnavailableResponse } from '@/modules/relay/routes/entities/gas-payment-option-unavailable-response.entity';
import { Relay } from '@/modules/relay/routes/entities/relay.entity';
import {
  SpaceRelayDto,
  SpaceRelayDtoSchema,
} from '@/modules/relay/routes/entities/space-relay.dto.entity';
import { SpaceRelayService } from '@/modules/relay/routes/space-relay.service';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { Auth } from '@/routes/common/auth/auth.decorator';
import { SpaceIdPipe } from '@/routes/common/pipes/space-id.pipe';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('relay')
@Controller({
  version: '1',
  path: 'spaces/:spaceId/chains/:chainId/relay',
})
export class SpaceRelayController {
  public constructor(private readonly spaceRelayService: SpaceRelayService) {}

  @ApiOperation({
    summary: "Relay a transaction, falling back on a workspace's allowance",
    description:
      'Relays as the chain-scoped route does — free options first, PAY_FROM_SAFE for a transaction that refunds gas. ' +
      "Where the chain lists SUBSCRIPTION, a call no free option can pay for, or whose free quota is spent, is relayed against the workspace's sponsored-transaction allowance instead, one unit per call — a batch included. " +
      'A call acting on an existing Safe is admitted only for a Safe the workspace holds; a Safe creation or a passkey signer deployment, having no Safe yet, is admitted.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe transaction will be executed',
    example: '1',
  })
  @ApiBody({ type: SpaceRelayDto })
  @ApiCreatedResponse({ type: Relay, description: 'Transaction relayed' })
  @ApiBadRequestResponse({ description: 'Malformed workspace identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description:
      'Not a member of the workspace, the chain offers nothing to pay for the call, or the transaction was denied',
  })
  @ApiConflictResponse({
    type: GasPaymentOptionUnavailableResponse,
    description:
      'The Safe is not one the workspace holds (NOT_A_WORKSPACE_SAFE), or a transaction that refunds gas needs PAY_FROM_SAFE, which the chain does not offer.',
  })
  @ApiNotFoundResponse({ description: 'Workspace not found' })
  @ApiResponse({
    status: HttpStatus.PAYMENT_REQUIRED,
    description:
      "The workspace's sponsored-transaction allowance is spent. The body carries `quota`, `used` and `resetsAt` so a client can offer to pay for the transaction itself.",
  })
  @ApiTooManyRequestsResponse({
    description:
      'The free quota is spent and the chain does not list SUBSCRIPTION',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Request failed schema validation, or the transaction was simulated and would revert (SIMULATION_FAILED) or could not be simulated (INDETERMINATE_SIMULATION)',
  })
  @Post()
  @UseGuards(AuthGuard)
  @RelayCalldataExceptionFilters()
  @UseFilters(
    QuotaExceededExceptionFilter,
    RelayLimitReachedExceptionFilter,
    SafeTxHashMismatchExceptionFilter,
  )
  public async relay(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Body(new ValidationPipe(SpaceRelayDtoSchema)) relayDto: SpaceRelayDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<Relay> {
    return await this.spaceRelayService.relay({
      spaceId,
      chainId,
      relayDto,
      authPayload,
    });
  }
}
