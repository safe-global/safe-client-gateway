import { Injectable } from '@nestjs/common';
import { Balance } from '../services/safe-transaction/entities/balance.entity';
import { SafeTransactionManager } from '../services/safe-transaction/safe-transaction.manager';

@Injectable()
export class BalancesService {
  constructor(
    private readonly safeTransactionManager: SafeTransactionManager,
  ) {}

  async getBalances(chainId: string, safeAddress: string): Promise<Balance[]> {
    const safeTransactionService =
      await this.safeTransactionManager.getTransactionService(chainId);
    return safeTransactionService.getBalances(safeAddress);
  }
}
