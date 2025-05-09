import { Controller, Post, Param, Get, UseFilters, Body } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
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

@ApiTags('relay')
@Controller({
  version: '1',
  path: 'chains/:chainId/relay',
})
export class RelayController {
  constructor(private readonly relayService: RelayService) {}

  @Post()
  @UseFilters(
    RelayLimitReachedExceptionFilter,
    InvalidMultiSendExceptionFilter,
    InvalidTransferExceptionFilter,
    UnofficialMasterCopyExceptionFilter,
    UnofficialMultiSendExceptionFilter,
    UnofficialProxyFactoryExceptionFilter,
  )
  @ApiOkResponse({ type: Relay })
  async relay(
    @Param('chainId') chainId: string,
    @Body(new ValidationPipe(RelayDtoSchema))
    relayDto: RelayDto,
  ): Promise<Relay> {
    return this.relayService.relay({ chainId, relayDto });
  }

  @ApiOkResponse({ type: RelaysRemaining })
  @Get(':safeAddress')
  async getRelaysRemaining(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<RelaysRemaining> {
    return this.relayService.getRelaysRemaining({ chainId, safeAddress });
  }
}
