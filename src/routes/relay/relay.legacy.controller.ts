import { Controller, Post, Redirect, Get } from '@nestjs/common';

@Controller({
  version: '1',
  path: 'relay/:chainId',
})
export class RelayLegacyController {
  @Post()
  @Redirect('/v1/chains/:chainId/relay')
  relay(): void {}

  @Get(':safeAddress')
  @Redirect('/v1/chains/:chainId/relay/:safeAddress')
  getRelaysRemaining(): void {}
}
