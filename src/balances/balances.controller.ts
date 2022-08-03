import { Controller, Get, Param } from '@nestjs/common';
import { Balance } from '../services/safe-transaction/entities/balance.entity'; // TODO expose different entity
import { BalancesService } from './balances.service';

@Controller({
  path: '',
})
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get('v1/chains/:chainId/safes/:safeAddress/balances')
  async getBalances(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
  ): Promise<Balance[]> {
    return this.balancesService.getBalances(chainId, safeAddress);
  }
}
