import { ISwapsApi } from '@/domain/interfaces/swaps-api.interface';

export const ISwapsApiFactory = Symbol('ISwapsApiFactory');

export interface ISwapsApiFactory {
  get(chainId: string): ISwapsApi;
}
