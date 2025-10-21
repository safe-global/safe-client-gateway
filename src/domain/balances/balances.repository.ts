import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import {
  Balance,
  BalanceSchema,
  BalancesSchema,
} from '@/domain/balances/entities/balance.entity';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { z } from 'zod';
import type { Address } from 'viem';

@Injectable()
export class BalancesRepository implements IBalancesRepository {
  constructor(
    @Inject(IBalancesApiManager)
    private readonly balancesApiManager: IBalancesApiManager,
  ) {}

  async getBalances(args: {
    chain: Chain;
    safeAddress: Address;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Array<Balance>> {
    const api = await this.balancesApiManager.getApi(
      args.chain.chainId,
      args.safeAddress,
    );
    const balances = await api.getBalances(args);
    return BalancesSchema.parse(balances);
  }

  async getTokenBalance(args: {
    chain: Chain;
    safeAddress: Address;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
    tokenAddress: Address;
  }): Promise<Balance | null> {
    const api = await this.balancesApiManager.getApi(
      args.chain.chainId,
      args.safeAddress,
    );
    const balance = await api.getBalance(args);
    return BalanceSchema.parse(balance);
  }

  async clearBalances(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const api = await this.balancesApiManager.getApi(
      args.chainId,
      args.safeAddress,
    );
    await api.clearBalances(args);
  }

  async getFiatCodes(): Promise<Array<string>> {
    return this.balancesApiManager
      .getFiatCodes()
      .then(z.array(z.string()).parse);
  }

  clearApi(chainId: string): void {
    this.balancesApiManager.destroyApi(chainId);
  }
}
