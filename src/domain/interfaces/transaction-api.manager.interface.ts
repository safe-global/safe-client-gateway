// SPDX-License-Identifier: FSL-1.1-MIT
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { IApiManager } from '@/domain/interfaces/api.manager.interface';

export const ITransactionApiManager = Symbol('ITransactionApiManager');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ITransactionApiManager extends IApiManager<ITransactionApi> {}
