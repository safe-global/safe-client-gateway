import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { Chain } from '../config-service/entities/chain.entity';
import { ConfigService } from '../config-service/config-service.service';
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
    private readonly configService: ConfigService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {}

  async getTransactionService(chainId: string): Promise<TransactionApi> {
    this.logger.log(`Getting TransactionService instance for chain ${chainId}`);
    const transactionService = this.transactionApiMap[chainId];
    if (transactionService !== undefined) return transactionService;

    this.logger.log(
      `Transaction Service for chain ${chainId} not available. Fetching from the Config Service`,
    );
    const chain: Chain = await this.configService.getChain(chainId);
    this.transactionApiMap[chainId] = new TransactionApi(
      chain.transactionService,
      this.networkService,
      this.httpErrorHandler,
    );
    return this.transactionApiMap[chainId];
  }
}
