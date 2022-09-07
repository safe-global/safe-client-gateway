import { ITransactionApi } from './transaction-api.interface';

export const ITransactionApiManager = Symbol('ITransactionApiManager');

export interface ITransactionApiManager {
  getTransactionApi(chainId: string): Promise<ITransactionApi>;
}
