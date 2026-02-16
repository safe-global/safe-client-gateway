import { type ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import { Module } from '@nestjs/common';
import { TransactionApiManager } from '@/modules/transactions/datasources/transaction-api.manager';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { type IApiManager } from '@/domain/interfaces/api.manager.interface';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';

export const ITransactionApiManager = Symbol('ITransactionApiManager');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
