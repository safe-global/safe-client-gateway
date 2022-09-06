import { Inject, Injectable } from '@nestjs/common';
import { Backbone } from '../chains/entities';
import { Balance } from './entities/balance.entity';
import { Chain } from './entities/chain.entity';
import { Page } from './entities/page.entity';
import { IConfigApi } from './config-api.interface';
import { IExchangeApi } from './exchange-api.interface';
import { IDomainRepository } from './domain.repository.interface';
import { ITransactionApiManager } from './transaction-api.manager.interface';

@Injectable()
export class DomainRepository implements IDomainRepository {
  constructor(
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    @Inject(IExchangeApi) private readonly exchangeApi: IExchangeApi,
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getBackbone(chainId: string): Promise<Backbone> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    return api.getBackbone();
  }

  async getBalances(
    chainId: string,
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    return api.getBalances(safeAddress, trusted, excludeSpam);
  }

  async getChain(chainId: string): Promise<Chain> {
    return this.configApi.getChain(chainId);
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    return this.configApi.getChains(limit, offset);
  }

  async convertRates(to: string, from: string): Promise<number> {
    return this.exchangeApi.convertRates(to, from);
  }

  async getFiatCodes(): Promise<string[]> {
    return this.exchangeApi.getFiatCodes();
  }
}
