import { Controller, Post, Get, HttpStatus, Res, Param } from '@nestjs/common';
import { Response } from 'express';

@Controller({
  version: '1',
  path: 'relay/:chainId',
})
export class RelayLegacyController {
  @Post()
  relay(@Param('chainId') chainId: string, @Res() res: Response): void {
    res.redirect(HttpStatus.PERMANENT_REDIRECT, `/v1/chains/${chainId}/relay`);
  }

  @Get(':safeAddress')
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
