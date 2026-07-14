// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { ChainApiManager } from '@/datasources/common/chain-api.manager';
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
import type { Raw } from '@/validation/entities/raw.entity';

@Injectable()
export class BalancesApiManager
  extends ChainApiManager<SafeBalancesApi>
  implements IBalancesApiManager
{
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
    super();
    this.useVpcUrl = this.configurationService.getOrThrow<boolean>(
      'safeTransaction.useVpcUrl',
    );
  }

  getApi(chainId: string): Promise<IBalancesApi> {
    return this.getOrCreateApi(chainId);
  }

  getFiatCodes(): Promise<Raw<Array<string>>> {
    return this.coingeckoApi.getFiatCodes();
  }

  protected async createApi(chainId: string): Promise<SafeBalancesApi> {
    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);

    return new SafeBalancesApi(
      chainId,
      this.useVpcUrl ? chain.vpcTransactionService : chain.transactionService,
      this.dataSource,
      this.cacheService,
      this.configurationService,
      this.httpErrorFactory,
      this.coingeckoApi,
      this.networkService,
    );
  }
}
