import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { TransactionApi } from '@/datasources/transaction-api/transaction-api.service';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';

@Injectable()
export class TransactionApiManager implements ITransactionApiManager {
  private transactionApiMap: Record<string, TransactionApi> = {};

  private readonly useVpcUrl: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly dataSource: CacheFirstDataSource,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(NetworkService) private readonly networkService: INetworkService,
  ) {
    this.useVpcUrl = this.configurationService.getOrThrow<boolean>(
      'safeTransaction.useVpcUrl',
    );
  }

  async getTransactionApi(chainId: string): Promise<TransactionApi> {
    const transactionApi = this.transactionApiMap[chainId];
    if (transactionApi !== undefined) return transactionApi;

    const chain: Chain = await this.configApi.getChain(chainId);
    this.transactionApiMap[chainId] = new TransactionApi(
      chainId,
      this.useVpcUrl ? chain.vpcTransactionService : chain.transactionService,
      this.dataSource,
      this.cacheService,
      this.configurationService,
      this.httpErrorFactory,
      this.networkService,
    );
    return this.transactionApiMap[chainId];
  }
}
