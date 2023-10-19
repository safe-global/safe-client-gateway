import { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';

export const ITransactionApiManager = Symbol('ITransactionApiManager');

export interface ITransactionApiManager {
  getTransactionApi(chainId: string): Promise<ITransactionApi>;
}
