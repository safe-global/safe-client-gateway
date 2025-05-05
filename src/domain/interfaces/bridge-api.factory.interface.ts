import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { IBridgeApi } from '@/domain/interfaces/bridge-api.inferface';

export const IBridgeApiFactory = Symbol('IBridgeApiFactory');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IBridgeApiFactory extends IApiManager<IBridgeApi> {}
