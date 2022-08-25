import { Controller, Get, Param } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { Balances } from './entities/balances.entity';

@Controller({
  path: '',
  version: '1',
})
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get('chains/:chainId/safes/:safeAddress/balances/:fiatCode')
  async getBalances(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Param('fiatCode') fiatCode: string,
  ): Promise<Balances> {
    return this.balancesService.getBalances(chainId, safeAddress, fiatCode);
  }

  @Get('balances/supported-fiat-codes')
  async getSupportedFiatCodes(): Promise<string[]> {
    return this.balancesService.getSupportedFiatCodes();
  }
}
