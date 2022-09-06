import { IBalancesRepository } from './balances.repository.interface';
import { Balance } from './entities/balance.entity';
import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';

@Injectable()
export class BalancesRepository implements IBalancesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getBalances(
    chainId: string,
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    return api.getBalances(safeAddress, trusted, excludeSpam);
  }
}
