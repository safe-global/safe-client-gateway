import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { SafeConfigChain } from '../safe-config/entities/chain.entity';
import { SafeConfigService } from '../safe-config/safe-config.service';
import { TransactionService } from './transaction-service.service';

@Injectable()
export class TransactionServiceManager {
  private readonly logger = new Logger(TransactionService.name);
  private transactionServiceMap: Record<string, TransactionService> = {};

  constructor(
    private readonly safeConfigService: SafeConfigService,
    private readonly httpService: HttpService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {}

  async getTransactionService(chainId: string): Promise<TransactionService> {
    this.logger.log(`Getting TransactionService instance for chain ${chainId}`);
    const transactionService = this.transactionServiceMap[chainId];
    if (transactionService !== undefined) return transactionService;

    this.logger.log(
      `Transaction Service for chain ${chainId} not available. Getting from the SafeConfigService`,
    );
    const chain: SafeConfigChain = await this.safeConfigService.getChain(
      chainId,
    );
    this.transactionServiceMap[chainId] = new TransactionService(
      chain.transactionService,
      this.httpService,
      this.httpErrorHandler,
    );
    return this.transactionServiceMap[chainId];
  }
}
