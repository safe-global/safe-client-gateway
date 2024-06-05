import { IConfigurationService } from '@/config/configuration.service.interface';
import { SafeBalancesApi } from '@/datasources/balances-api/safe-balances-api.service';
import { IZerionBalancesApi } from '@/datasources/balances-api/zerion-balances-api.service';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { IPricesApi } from '@/datasources/balances-api/prices-api.interface';
import { Inject, Injectable } from '@nestjs/common';
import { intersection } from 'lodash';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';

@Injectable()
export class BalancesApiManager implements IBalancesApiManager {
  private safeBalancesApiMap: Record<string, SafeBalancesApi> = {};
  private readonly zerionChainIds: string[];
  private readonly zerionBalancesApi: IBalancesApi;
  private readonly useVpcUrl: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly dataSource: CacheFirstDataSource,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(IZerionBalancesApi) zerionBalancesApi: IBalancesApi,
    @Inject(IPricesApi) private readonly coingeckoApi: IPricesApi,
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {
    this.zerionChainIds = this.configurationService.getOrThrow<string[]>(
      'features.zerionBalancesChainIds',
    );
    this.useVpcUrl = this.configurationService.getOrThrow<boolean>(
      'safeTransaction.useVpcUrl',
    );
    this.zerionBalancesApi = zerionBalancesApi;
  }

  async getBalancesApi(
    chainId: string,
    safeAddress: `0x${string}`,
  ): Promise<IBalancesApi> {
    if (this.zerionChainIds.includes(chainId)) {
      return this.zerionBalancesApi;
    }

    try {
      const transactionApi =
        await this.transactionApiManager.getTransactionApi(chainId);
      await transactionApi.getSafe(safeAddress);
      return this._getSafeBalancesApi(chainId);
    } catch (err) {
      return this.zerionBalancesApi;
    }
  }

  async getFiatCodes(): Promise<string[]> {
    const zerionFiatCodes = await this.zerionBalancesApi.getFiatCodes();
    const safeFiatCodes = await this.coingeckoApi.getFiatCodes();
    return intersection(zerionFiatCodes, safeFiatCodes).sort();
  }

  private async _getSafeBalancesApi(chainId: string): Promise<SafeBalancesApi> {
    const safeBalancesApi = this.safeBalancesApiMap[chainId];
    if (safeBalancesApi !== undefined) return safeBalancesApi;

    const chain = await this.configApi.getChain(chainId);
    this.safeBalancesApiMap[chainId] = new SafeBalancesApi(
      chainId,
      this.useVpcUrl ? chain.vpcTransactionService : chain.transactionService,
      this.dataSource,
      this.cacheService,
      this.configurationService,
      this.httpErrorFactory,
      this.coingeckoApi,
    );
    return this.safeBalancesApiMap[chainId];
  }
}
