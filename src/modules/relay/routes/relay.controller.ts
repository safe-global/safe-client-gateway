// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import { InvalidMultiSendExceptionFilter } from '@/modules/relay/domain/exception-filters/invalid-multisend.exception-filter';
import { InvalidTransferExceptionFilter } from '@/modules/relay/domain/exception-filters/invalid-transfer.exception-filter';
import { RelayDeniedExceptionFilter } from '@/modules/relay/domain/exception-filters/relay-denied.exception-filter';
import { RelayLimitReachedExceptionFilter } from '@/modules/relay/domain/exception-filters/relay-limit-reached.exception-filter';
import { SafeTxHashMismatchExceptionFilter } from '@/modules/relay/domain/exception-filters/safe-tx-hash-mismatch.exception-filter';
import { UnofficialMasterCopyExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-master-copy.exception-filter';
import { UnofficialMultiSendExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-multisend.error';
import { UnofficialProxyFactoryExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-proxy-factory.exception-filter';
import { UnofficialSignerFactoryExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-signer-factory.exception-filter';
import { RelayDto } from '@/modules/relay/routes/entities/relay.dto.entity';
import { Relay } from '@/modules/relay/routes/entities/relay.entity';
import { RelayTaskStatus } from '@/modules/relay/routes/entities/relay-task-status.entity';
import { RelaysRemaining } from '@/modules/relay/routes/entities/relays-remaining.entity';
import { RelayDtoSchema } from '@/modules/relay/routes/entities/schemas/relay.dto.schema';
import { RelayService } from '@/modules/relay/routes/relay.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('relay')
@Controller({
  version: '1',
  path: 'chains/:chainId/relay',
})
export class RelayController {
  constructor(private readonly relayService: RelayService) {}

  @ApiOperation({
    summary: 'Relay transaction',
    description:
      'Relays a Safe transaction or Safe creation transaction using the relay service, which pays for gas fees. ' +
      'Supports execTransaction (Safe tx) and createProxyWithNonce (Safe creation) calldata. ' +
      'On relay-fee chains, safeTxHash is required and must match the hash derived on-chain from the submitted calldata.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe transaction will be executed',
    example: '1',
  })
  @ApiBody({
    type: RelayDto,
    description:
      'Transaction data to relay. safeTxHash is required on relay-fee chains and must correspond to the to + data fields.',
  })
  @ApiOkResponse({
    type: Relay,
    description: 'Transaction relayed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Request body failed schema validation',
  })
  @ApiForbiddenResponse({
    description:
      'Relay denied: safeTxHash missing, fee service rejected, or unofficial proxy factory',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'safeTxHash does not match the transaction data, or unrecognised transaction type',
  })
  @ApiTooManyRequestsResponse({
    description: 'Relay limit reached for this Safe',
  })
  @Post()
  @UseFilters(
    RelayLimitReachedExceptionFilter,
    RelayDeniedExceptionFilter,
    SafeTxHashMismatchExceptionFilter,
    InvalidMultiSendExceptionFilter,
    InvalidTransferExceptionFilter,
    UnofficialMasterCopyExceptionFilter,
    UnofficialMultiSendExceptionFilter,
    UnofficialProxyFactoryExceptionFilter,
    UnofficialSignerFactoryExceptionFilter,
  )
  async relay(
    @Param('chainId') chainId: string,
    @Body(new ValidationPipe(RelayDtoSchema))
    relayDto: RelayDto,
  ): Promise<Relay> {
    return await this.relayService.relay({ chainId, relayDto });
  }

  @ApiOperation({
    summary: 'Get relay task status',
    description:
      'Retrieves the status of a relay task from the relay provider. This is a proxy endpoint to securely query task status without exposing the API key.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID associated with the relay task',
    example: '11155111',
  })
  @ApiParam({
    name: 'taskId',
    type: 'string',
    description: 'Task ID returned from the relay transaction',
  })
  @ApiOkResponse({
    type: RelayTaskStatus,
    description: 'Task status retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Task not found',
  })
  @Get('status/:taskId')
  async getTaskStatus(
    @Param('chainId') chainId: string,
    @Param('taskId') taskId: string,
  ): Promise<RelayTaskStatus> {
    return await this.relayService.getTaskStatus({ chainId, taskId });
  }

  @ApiOperation({
    summary: 'Get remaining relays',
    description:
      'Retrieves the number of remaining relay transactions available for a specific Safe on the given chain. ' +
      'On relay-fee chains, safeTxHash is forwarded to the fee service to determine per-transaction eligibility ' +
      '(returns remaining=1 when eligible, 0 when not). ' +
      'On daily-limit and no-fee-campaign chains, a count-based quota is returned.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'safeTxHash',
    required: false,
    description:
      'Safe transaction hash (0x prefixed hex string). ' +
      'Required on relay-fee chains to check per-transaction eligibility with the fee service. ' +
      'Optional on daily-limit and no-fee-campaign chains.',
  })
  @ApiOkResponse({
    type: RelaysRemaining,
    description: 'Remaining relay quota retrieved successfully',
  })
  @Get(':safeAddress')
  async getRelaysRemaining(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Query('safeTxHash', new ValidationPipe(HexSchema.optional()))
    safeTxHash?: Hex,
  ): Promise<RelaysRemaining> {
    return await this.relayService.getRelaysRemaining({
      chainId,
      safeAddress,
      safeTxHash,
    });
  }
}
