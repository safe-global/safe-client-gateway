import { Inject, Injectable } from '@nestjs/common';
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
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { ChainSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';
import { TransactionApi } from '@/modules/transactions/datasources/transaction-api.service';

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
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.useVpcUrl = this.configurationService.getOrThrow<boolean>(
      'safeTransaction.useVpcUrl',
    );
  }

  async getApi(chainId: string): Promise<TransactionApi> {
    const transactionApi = this.transactionApiMap[chainId];
    if (transactionApi !== undefined) return transactionApi;

    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);
    this.transactionApiMap[chainId] = new TransactionApi(
      chainId,
      this.useVpcUrl ? chain.vpcTransactionService : chain.transactionService,
      this.dataSource,
      this.cacheService,
      this.configurationService,
      this.httpErrorFactory,
      this.networkService,
      this.loggingService,
    );
    return this.transactionApiMap[chainId];
  }

  destroyApi(chainId: string): void {
    if (this.transactionApiMap[chainId] !== undefined) {
      delete this.transactionApiMap[chainId];
    }
  }
}
