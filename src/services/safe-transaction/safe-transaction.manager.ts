import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { SafeConfigChain } from '../safe-config/entities/chain.entity';
import { ISafeConfigService } from '../safe-config/safe-config.service';
import { ISafeTransactionManager } from './safe-transaction.manager.interface';
import {
  ISafeTransactionService,
  SafeTransactionService,
} from './safe-transaction.service';

@Injectable()
export class SafeTransactionManager implements ISafeTransactionManager {
  private transactionServiceMap: Record<string, ISafeTransactionService> = {};

  constructor(
    @Inject('ISafeConfigService')
    private readonly safeConfigService: ISafeConfigService,
    private readonly httpService: HttpService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {}

  async getTransactionService(
    chainId: string,
  ): Promise<ISafeTransactionService> {
    console.log(`Getting TransactionService instance for chain ${chainId}`);
    const transactionService = this.transactionServiceMap[chainId];
    if (transactionService !== undefined) return transactionService;

    console.log(
      `Transaction Service for chain ${chainId} not available. Getting from the SafeConfigService`,
    );
    const chain: SafeConfigChain = await this.safeConfigService.getChain(
      chainId,
    );
    this.transactionServiceMap[chainId] = new SafeTransactionService(
      chain.transactionService,
      this.httpService,
      this.httpErrorHandler,
    );
    return this.transactionServiceMap[chainId];
  }
}
