import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { TransactionsRepository } from '@/domain/transactions/transactions.repository';
import { Module } from '@nestjs/common';

export const ITransactionsRepository = Symbol('ITransactionsRepository');

export interface ITransactionsRepository {
  clearApi(chainId: string): void;
}

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    { provide: ITransactionsRepository, useClass: TransactionsRepository },
  ],
  exports: [ITransactionsRepository],
})
export class TransactionsRepositoryModule {}
