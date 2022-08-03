import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { SafeConfigChain } from '../safe-config/entities/chain.entity';
import { SafeConfigService } from '../safe-config/safe-config.service';
import { SafeTransactionService } from './safe-transaction.service';

@Injectable()
export class SafeTransactionManager {
  private transactionServiceMap: Record<string, SafeTransactionService> = {};

  constructor(
    private readonly safeConfigService: SafeConfigService,
    private readonly httpService: HttpService,
  ) {}

  async getTransactionService(
    chainId: string,
  ): Promise<SafeTransactionService> {
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
    );
    return this.transactionServiceMap[chainId];
  }
}
