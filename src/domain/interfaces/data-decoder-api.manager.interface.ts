import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';

export const IDataDecoderApiManager = Symbol('IDataDecoderApiManager');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IDataDecoderApiManager extends IApiManager<IDataDecoderApi> {}
