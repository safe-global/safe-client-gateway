import { IApiManager } from '@/domain/interfaces/api.manager.interface';
import { ISwapsApi } from '@/domain/interfaces/swaps-api.interface';

export const ISwapsApiFactory = Symbol('ISwapsApiFactory');

export interface ISwapsApiFactory extends IApiManager<ISwapsApi> {}
