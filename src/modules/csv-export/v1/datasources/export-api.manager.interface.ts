// SPDX-License-Identifier: FSL-1.1-MIT
import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { IExportApi } from '@/modules/csv-export/v1/datasources/export-api.interface';

export const IExportApiManager = Symbol('IExportApiManager');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IExportApiManager extends IApiManager<IExportApi> {}
