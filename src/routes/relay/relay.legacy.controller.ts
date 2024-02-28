import { RelayLegacyDto } from '@/routes/relay/entities/relay.legacy.dto.entity';
import { RelayLegacyDtoValidationPipe } from '@/routes/relay/pipes/relay.legacy.validation.pipe';
import {
  Controller,
  Post,
  Get,
  HttpStatus,
  Res,
  Param,
  Body,
} from '@nestjs/common';
import { Response } from 'express';

@Controller({
  version: '1',
  path: 'relay',
})
export class RelayLegacyController {
  @Post()
  relay(
    @Body(RelayLegacyDtoValidationPipe)
    relayLegacyDto: RelayLegacyDto,
    @Res() res: Response,
  ): void {
    res.redirect(
      HttpStatus.PERMANENT_REDIRECT,
      `/v1/chains/${relayLegacyDto.chainId}/relay`,
    );
  }

  @Get('/:chainId/:safeAddress')
  getRelaysRemaining(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Res() res: Response,
  ): void {
    res.redirect(
      HttpStatus.MOVED_PERMANENTLY,
      `/v1/chains/${chainId}/relay/${safeAddress}`,
    );
  }
}
