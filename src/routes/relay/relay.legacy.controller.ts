import { RelayLegacyDto } from '@/routes/relay/entities/relay.legacy.dto.entity';
import { RelayLegacyDtoValidationPipe } from '@/routes/relay/pipes/relay.legacy.validation.pipe';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Redirect,
} from '@nestjs/common';

@Controller({
  version: '1',
  path: 'relay',
})
export class RelayLegacyController {
  @Post()
  @Redirect(undefined, HttpStatus.PERMANENT_REDIRECT)
  relay(
    @Body(RelayLegacyDtoValidationPipe)
    relayLegacyDto: RelayLegacyDto,
  ): { url: string } {
    return { url: `/v1/chains/${relayLegacyDto.chainId}/relay` };
  }

  @Get('/:chainId/:safeAddress')
  @Redirect(undefined, HttpStatus.MOVED_PERMANENTLY)
  getRelaysRemaining(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
  ): { url: string } {
    return { url: `/v1/chains/${chainId}/relay/${safeAddress}` };
  }
}
