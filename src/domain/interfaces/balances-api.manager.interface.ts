import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';

export const IBalancesApiManager = Symbol('IBalancesApiManager');

export interface IBalancesApiManager {
  isExternalized(chainId: string): boolean;
  getBalancesApi(chainId: string): IBalancesApi;
}
