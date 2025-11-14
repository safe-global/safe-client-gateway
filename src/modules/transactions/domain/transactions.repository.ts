import { TransactionApiManager } from '@/modules/transactions/datasources/transaction-api.manager';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { ITransactionsRepository } from '@/modules/transactions/domain/transactions.repository.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class TransactionsRepository implements ITransactionsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: TransactionApiManager,
  ) {}

  clearApi(chainId: string): void {
    this.transactionApiManager.destroyApi(chainId);
  }
}
