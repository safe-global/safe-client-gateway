import { ISwapsApi } from '@/domain/interfaces/swaps-api.interface';

export const ISwapsApiFactory = Symbol('ISwapsApiFactory');

// TODO: Extend IApiManager interface and clear on `CHAIN_UPDATE`
export interface ISwapsApiFactory {
  get(chainId: string): ISwapsApi;
}
