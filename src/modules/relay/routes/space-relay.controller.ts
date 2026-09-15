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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { QuotaExceededExceptionFilter } from '@/modules/entitlements/domain/exception-filters/quota-exceeded.exception-filter';
import { InvalidMultiSendExceptionFilter } from '@/modules/relay/domain/exception-filters/invalid-multisend.exception-filter';
import { InvalidTransferExceptionFilter } from '@/modules/relay/domain/exception-filters/invalid-transfer.exception-filter';
import { RelayDeniedExceptionFilter } from '@/modules/relay/domain/exception-filters/relay-denied.exception-filter';
import { RelayerNotAvailableExceptionFilter } from '@/modules/relay/domain/exception-filters/relayer-not-available.exception-filter';
import { UnofficialMasterCopyExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-master-copy.exception-filter';
import { UnofficialMultiSendExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-multisend.error';
import { UnofficialProxyFactoryExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-proxy-factory.exception-filter';
import { UnofficialSignerFactoryExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-signer-factory.exception-filter';
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
    summary: "Relay a transaction at a workspace's expense",
    description:
      "Relays a Safe transaction against the workspace's sponsored-transaction allowance, which its plan grants and this spends one unit of per call — a batch included. " +
      "Unlike the chain-scoped relay endpoint, the chain's own relayer policy does not apply: the allowance is the only limit. " +
      'A call acting on an existing Safe is admitted only for a Safe the workspace holds; a Safe creation or a passkey signer deployment, having no Safe yet, is admitted as it is there.',
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
      'Not a member of the workspace, the Safe is not one it holds, the chain has no relayer, or the transaction was denied',
  })
  @ApiNotFoundResponse({ description: 'Workspace not found' })
  @ApiResponse({
    status: HttpStatus.PAYMENT_REQUIRED,
    description:
      "The workspace's sponsored-transaction allowance is spent. The body carries `quota`, `used` and `resetsAt` so a client can offer to pay for the transaction itself.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: "The chain's relayer type is not supported",
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Request failed schema validation, or the transaction was simulated and would revert (SIMULATION_FAILED) or could not be simulated (INDETERMINATE_SIMULATION)',
  })
  @Post()
  @UseGuards(AuthGuard)
  @UseFilters(
    QuotaExceededExceptionFilter,
    RelayDeniedExceptionFilter,
    RelayerNotAvailableExceptionFilter,
    InvalidMultiSendExceptionFilter,
    InvalidTransferExceptionFilter,
    UnofficialMasterCopyExceptionFilter,
    UnofficialMultiSendExceptionFilter,
    UnofficialProxyFactoryExceptionFilter,
    UnofficialSignerFactoryExceptionFilter,
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
