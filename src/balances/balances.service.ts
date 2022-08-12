import { Injectable } from '@nestjs/common';
import { Balance } from '../services/transaction-service/entities/balance.entity';
import { TransactionServiceManager } from '../services/transaction-service/transaction-service.manager';

@Injectable()
export class BalancesService {
  constructor(
    private readonly transactionServiceManager: TransactionServiceManager,
  ) {}

  async getBalances(chainId: string, safeAddress: string): Promise<Balance[]> {
    const transactionService =
      await this.transactionServiceManager.getTransactionService(chainId);
    return transactionService.getBalances(safeAddress);
  }
}
