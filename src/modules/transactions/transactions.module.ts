import { Module } from '@nestjs/common';
import { TransactionApiModule } from '@/modules/transactions/datasources/transaction-api.module';
import { TransactionsRepositoryModule } from '@/modules/transactions/domain/transactions.repository.interface';
import { TransactionsModule as TransactionsRoutesModule } from '@/modules/transactions/routes/transactions.module';

@Module({
  imports: [
    TransactionApiModule,
    TransactionsRepositoryModule,
    TransactionsRoutesModule,
  ],
})
export class TransactionsModule {}
