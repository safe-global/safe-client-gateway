import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { ISwapsApi } from '@/domain/interfaces/swaps-api.interface';

export const ISwapsApiFactory = Symbol('ISwapsApiFactory');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ISwapsApiFactory extends IApiManager<ISwapsApi> {}
