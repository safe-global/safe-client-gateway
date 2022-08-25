import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { Chain } from '../config-api/entities/chain.entity';
import { ConfigApi } from '../config-api/config-api.service';
import { TransactionApi } from './transaction-api.service';
import {
  INetworkService,
  NetworkService,
} from '../../common/network/network.service.interface';

@Injectable()
export class TransactionApiManager {
  private readonly logger = new Logger(TransactionApi.name);
  private transactionApiMap: Record<string, TransactionApi> = {};

  constructor(
    private readonly configApi: ConfigApi,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
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
      chain.transactionService,
      this.networkService,
      this.httpErrorFactory,
    );
    return this.transactionApiMap[chainId];
  }
}
