import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { IExportApi } from '@/modules/csv-export/v1/export-api.interface';
import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { ExportApiManager } from '@/modules/csv-export/v1/export-api.manager';

export const IExportApiManager = Symbol('IExportApiManager');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IExportApiManager extends IApiManager<IExportApi> {}

@Module({
  imports: [CacheFirstDataSourceModule, ConfigApiModule],
  providers: [
    { provide: IExportApiManager, useClass: ExportApiManager },
    HttpErrorFactory,
  ],
  exports: [IExportApiManager],
})
export class ExportApiManagerModule {}
