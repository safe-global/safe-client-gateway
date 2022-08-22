import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { Chain } from '../config-service/entities/chain.entity';
import { ConfigService } from '../config-service/config-service.service';
import { TransactionService } from './transaction-service.service';
import { INetworkService, NetworkService } from '../../common/network/network.service.interface';

@Injectable()
export class TransactionServiceManager {
  private readonly logger = new Logger(TransactionService.name);
  private transactionServiceMap: Record<string, TransactionService> = {};

  constructor(
    private readonly configService: ConfigService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {}

  async getTransactionService(chainId: string): Promise<TransactionService> {
    this.logger.log(`Getting TransactionService instance for chain ${chainId}`);
    const transactionService = this.transactionServiceMap[chainId];
    if (transactionService !== undefined) return transactionService;

    this.logger.log(
      `Transaction Service for chain ${chainId} not available. Fetching from the Config Service`,
    );
    const chain: Chain = await this.configService.getChain(chainId);
    this.transactionServiceMap[chainId] = new TransactionService(
      chain.transactionService,
      this.networkService,
      this.httpErrorHandler,
    );
    return this.transactionServiceMap[chainId];
  }
}
