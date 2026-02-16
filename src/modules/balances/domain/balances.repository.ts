import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/modules/balances/domain/balances.repository.interface';
import {
  type Balance,
  BalanceSchema,
  BalancesSchema,
} from '@/modules/balances/domain/entities/balance.entity';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { type Chain } from '@/modules/chains/domain/entities/chain.entity';
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
    tokenAddress: Address;
    trusted?: boolean;
    excludeSpam?: boolean;
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
    await api.clearBalances({ safeAddress: args.safeAddress });
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
