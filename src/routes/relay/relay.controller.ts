import { Controller, Post, Param, Get, UseFilters, Body } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { RelayDto } from '@/routes/relay/entities/relay.dto.entity';
import { RelayService } from '@/routes/relay/relay.service';
import { RelayLimitReachedExceptionFilter } from '@/domain/relay/exception-filters/relay-limit-reached.exception-filter';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { InvalidMultiSendExceptionFilter } from '@/domain/relay/exception-filters/invalid-multisend.exception-filter';
import { InvalidTransferExceptionFilter } from '@/domain/relay/exception-filters/invalid-transfer.exception-filter';
import { UnofficialMasterCopyExceptionFilter } from '@/domain/relay/exception-filters/unofficial-master-copy.exception-filter';
import { UnofficialMultiSendExceptionFilter } from '@/domain/relay/exception-filters/unofficial-multisend.error';
import { UnofficialProxyFactoryExceptionFilter } from '@/domain/relay/exception-filters/unofficial-proxy-factory.exception-filter';
import { RelayDtoSchema } from '@/routes/relay/entities/schemas/relay.dto.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { Relay } from '@/routes/relay/entities/relay.entity';
import { RelaysRemaining } from '@/routes/relay/entities/relays-remaining.entity';
import type { Address } from 'viem';

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
      'Relays a Safe transaction using the relay service, which pays for gas fees. The transaction must meet certain criteria and the Safe must have remaining relay quota.',
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
      'Transaction data to relay including Safe address, transaction details, and signatures',
  })
  @ApiOkResponse({
    type: Relay,
    description: 'Transaction relayed successfully with transaction hash',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid transaction data, unofficial contracts, or unsupported operation',
  })
  @ApiTooManyRequestsResponse({
    description: 'Relay limit reached for this Safe',
  })
  @Post()
  @UseFilters(
    RelayLimitReachedExceptionFilter,
    InvalidMultiSendExceptionFilter,
    InvalidTransferExceptionFilter,
    UnofficialMasterCopyExceptionFilter,
    UnofficialMultiSendExceptionFilter,
    UnofficialProxyFactoryExceptionFilter,
  )
  async relay(
    @Param('chainId') chainId: string,
    @Body(new ValidationPipe(RelayDtoSchema))
    relayDto: RelayDto,
  ): Promise<Relay> {
    return this.relayService.relay({ chainId, relayDto });
  }

  @ApiOperation({
    summary: 'Get remaining relays',
    description:
      'Retrieves the number of remaining relay transactions available for a specific Safe on the given chain.',
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
  @ApiOkResponse({
    type: RelaysRemaining,
    description: 'Remaining relay quota retrieved successfully',
  })
  @Get(':safeAddress')
  async getRelaysRemaining(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
  ): Promise<RelaysRemaining> {
    return this.relayService.getRelaysRemaining({ chainId, safeAddress });
  }
}
