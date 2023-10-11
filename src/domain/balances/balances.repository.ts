import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { BalancesValidator } from '@/domain/balances/balances.validator';
import { Balance } from '@/domain/balances/entities/balance.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';

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
