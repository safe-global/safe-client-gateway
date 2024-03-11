import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { Balance } from '@/domain/balances/entities/balance.entity';
import { BalanceSchema } from '@/domain/balances/entities/schemas/balance.schema';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';

@Injectable()
export class BalancesRepository implements IBalancesRepository {
  constructor(
    @Inject(IBalancesApiManager)
    private readonly balancesApiManager: IBalancesApiManager,
  ) {}

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]> {
    const api = await this.balancesApiManager.getBalancesApi(args.chainId);
    const balances = await api.getBalances(args);
    return balances.map((balance) => BalanceSchema.parse(balance));
  }

  async clearBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const api = await this.balancesApiManager.getBalancesApi(args.chainId);
    await api.clearBalances(args);
  }

  async getFiatCodes(): Promise<string[]> {
    return this.balancesApiManager.getFiatCodes();
  }
}
