// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';
import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import { TransactionApiManager } from '@/modules/transactions/datasources/transaction-api.manager';

export const ITransactionApiManager = Symbol('ITransactionApiManager');

export interface ITransactionApiManager extends IApiManager<ITransactionApi> {}

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
