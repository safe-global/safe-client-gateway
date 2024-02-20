import { Controller, Post, Redirect, Get, HttpStatus } from '@nestjs/common';

@Controller({
  version: '1',
  path: 'relay/:chainId',
})
export class RelayLegacyController {
  @Post()
  @Redirect('/v1/chains/:chainId/relay', HttpStatus.PERMANENT_REDIRECT)
  relay(): void {}

  @Get(':safeAddress')
  @Redirect(
    '/v1/chains/:chainId/relay/:safeAddress',
    HttpStatus.MOVED_PERMANENTLY,
  )
  getRelaysRemaining(): void {}
}
