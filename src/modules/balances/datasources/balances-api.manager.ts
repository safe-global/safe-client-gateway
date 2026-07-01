// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import type { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { IPricesApi } from '@/modules/balances/datasources/prices-api.interface';
import { SafeBalancesApi } from '@/modules/balances/datasources/safe-balances-api.service';
import { ChainSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';
import { type Raw, rawify } from '@/validation/entities/raw.entity';

@Injectable()
export class BalancesApiManager implements IBalancesApiManager {
  private safeBalancesApiMap: Record<string, SafeBalancesApi> = {};
  private readonly useVpcUrl: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly dataSource: CacheFirstDataSource,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(IPricesApi) private readonly coingeckoApi: IPricesApi,
    @Inject(NetworkService) private readonly networkService: INetworkService,
  ) {
    this.useVpcUrl = this.configurationService.getOrThrow<boolean>(
      'safeTransaction.useVpcUrl',
    );
  }

  getApi(chainId: string, _safeAddress: Address): Promise<IBalancesApi> {
    return this._getSafeBalancesApi(chainId);
  }

  async getFiatCodes(): Promise<Raw<Array<string>>> {
    return rawify(await this.coingeckoApi.getFiatCodes());
  }

  private async _getSafeBalancesApi(chainId: string): Promise<SafeBalancesApi> {
    const safeBalancesApi = this.safeBalancesApiMap[chainId];
    if (safeBalancesApi !== undefined) return safeBalancesApi;

    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);
    this.safeBalancesApiMap[chainId] = new SafeBalancesApi(
      chainId,
      this.useVpcUrl ? chain.vpcTransactionService : chain.transactionService,
      this.dataSource,
      this.cacheService,
      this.configurationService,
      this.httpErrorFactory,
      this.coingeckoApi,
      this.networkService,
    );
    return this.safeBalancesApiMap[chainId];
  }

  destroyApi(chainId: string): void {
    if (this.safeBalancesApiMap[chainId] !== undefined) {
      delete this.safeBalancesApiMap[chainId];
    }
  }
}
