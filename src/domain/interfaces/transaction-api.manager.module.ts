// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { TransactionApiManager } from '@/modules/transactions/datasources/transaction-api.manager';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';

@Module({
  imports: [ConfigApiModule, TxAuthNetworkModule],
  providers: [
    {
      provide: ITransactionApiManager,
      useClass: TransactionApiManager,
    },
  ],
  exports: [ITransactionApiManager],
})
export class TransactionApiManagerModule {}
