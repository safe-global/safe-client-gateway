import { Inject, Injectable } from '@nestjs/common';
import { Chain } from '../../domain/chains/entities/chain.entity';
import { TransactionApi } from './transaction-api.service';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { ITransactionApiManager } from '../../domain/interfaces/transaction-api.manager.interface';
import { IConfigApi } from '../../domain/interfaces/config-api.interface';
import { CacheService, ICacheService } from '../cache/cache.service.interface';
import { HttpErrorFactory } from '../errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '../network/network.service.interface';
import { IConfigurationService } from '../../config/configuration.service.interface';

@Injectable()
export class TransactionApiManager implements ITransactionApiManager {
  private transactionApiMap: Record<string, TransactionApi> = {};

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly dataSource: CacheFirstDataSource,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(NetworkService) private readonly networkService: INetworkService,
  ) {}

  async getTransactionApi(chainId: string): Promise<TransactionApi> {
    const transactionApi = this.transactionApiMap[chainId];
    if (transactionApi !== undefined) return transactionApi;

    // TODO replace with getOrThrow once https://github.com/safe-global/safe-client-gateway-nest/issues/318 is done
    // By requiring a new environment variable to be set, a lot of tests need to be adjusted to configure this
    // new variable
    const useVpcUrl =
      this.configurationService.get<boolean>('safeTransaction.useVpcUrl') ??
      false;

    const chain: Chain = await this.configApi.getChain(chainId);
    this.transactionApiMap[chainId] = new TransactionApi(
      chainId,
      useVpcUrl ? chain.vpcTransactionService : chain.transactionService,
      this.dataSource,
      this.cacheService,
      this.httpErrorFactory,
      this.networkService,
    );
    return this.transactionApiMap[chainId];
  }
}
