import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { BalancesValidator } from '@/domain/balances/balances.validator';
import { Balance } from '@/domain/balances/entities/balance.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { SimpleBalancesValidator } from '@/domain/balances/simple-balances.validator';
import { SimpleBalance } from '@/domain/balances/entities/simple-balance.entity';

@Injectable()
export class BalancesRepository implements IBalancesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly balancesValidator: BalancesValidator,
    private readonly simpleBalancesValidator: SimpleBalancesValidator,
  ) {}

  /**
   * @deprecated to be removed after Coingecko prices retrieval is complete.
   */
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
    return balances.map((balance) => this.balancesValidator.validate(balance));
  }

  async getSimpleBalances(args: {
    chainId: string;
    safeAddress: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<SimpleBalance[]> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    const balances = await api.getSimpleBalances({
      safeAddress: args.safeAddress,
      trusted: args.trusted,
      excludeSpam: args.excludeSpam,
    });
    return balances.map((balance) =>
      this.simpleBalancesValidator.validate(balance),
    );
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
