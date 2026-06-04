// SPDX-License-Identifier: FSL-1.1-MIT
import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { IBridgeApi } from '@/domain/interfaces/bridge-api.inferface';

export const IBridgeApiFactory = Symbol('IBridgeApiFactory');

export interface IBridgeApiFactory extends IApiManager<IBridgeApi> {}
