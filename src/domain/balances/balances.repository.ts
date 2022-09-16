import { IBalancesRepository } from './balances.repository.interface';
import { Balance } from './entities/balance.entity';
import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { BalancesValidator } from './balances.validator';

@Injectable()
export class BalancesRepository implements IBalancesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validator: BalancesValidator,
  ) {}

  async getBalances(
    chainId: string,
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    const balances = await api.getBalances(safeAddress, trusted, excludeSpam);

    return this.validator.validateMany(balances);
  }

  async clearLocalBalances(
    chainId: string,
    safeAddress: string,
  ): Promise<void> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    await api.clearLocalBalances(safeAddress);
  }
}
