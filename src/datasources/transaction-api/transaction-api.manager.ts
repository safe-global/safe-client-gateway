import { Inject, Injectable, Logger } from '@nestjs/common';
import { Chain } from '../../domain/entities/chain.entity';
import { TransactionApi } from './transaction-api.service';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { ITransactionApiManager } from '../../domain/transaction-api.manager.interface';
import { IConfigApi } from '../../domain/config-api.interface';

@Injectable()
export class TransactionApiManager implements ITransactionApiManager {
  private readonly logger = new Logger(TransactionApi.name);
  private transactionApiMap: Record<string, TransactionApi> = {};

  constructor(
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly dataSource: CacheFirstDataSource,
  ) {}

  async getTransactionApi(chainId: string): Promise<TransactionApi> {
    this.logger.log(`Getting TransactionApi instance for chain ${chainId}`);
    const transactionApi = this.transactionApiMap[chainId];
    if (transactionApi !== undefined) return transactionApi;

    this.logger.log(
      `Transaction API for chain ${chainId} not available. Fetching from the Config Service`,
    );
    const chain: Chain = await this.configApi.getChain(chainId);
    this.transactionApiMap[chainId] = new TransactionApi(
      chainId,
      chain.transactionService,
      this.dataSource,
    );
    return this.transactionApiMap[chainId];
  }
}
