import { Inject, Injectable } from '@nestjs/common';
import { Balance } from 'src/services/safe-transaction/entities/balance.entity';
import { ISafeTransactionManager } from 'src/services/safe-transaction/safe-transaction.manager.interface';

@Injectable()
export class BalancesService {
  constructor(
    @Inject('ISafeTransactionManager')
    private readonly safeTransactionManager: ISafeTransactionManager,
  ) {}

  async getBalances(chainId: string, safeAddress: string): Promise<Balance[]> {
    const safeTransactionService =
      await this.safeTransactionManager.getTransactionService(chainId);
    return safeTransactionService.getBalances(safeAddress);
  }
}
