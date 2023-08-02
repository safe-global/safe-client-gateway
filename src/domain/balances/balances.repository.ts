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

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    const balances = await api.getBalances({
      safeAddress: args.safeAddress,
      trusted: args.trusted,
      excludeSpam: args.excludeSpam,
    });
    return balances.map((balance) => this.validator.validate(balance));
  }

  async clearLocalBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    await api.clearLocalBalances(args.safeAddress);
  }
}
