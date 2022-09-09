import { Controller, Get, Param } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { Balances } from './entities/balances.entity';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Balances as ApiBalances } from './openapi/api-balances';

@ApiTags('balances')
@Controller({
  path: '',
  version: '1',
})
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @ApiOkResponse({ type: ApiBalances })
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
