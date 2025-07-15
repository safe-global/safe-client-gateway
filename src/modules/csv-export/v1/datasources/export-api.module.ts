import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IExportApi } from '@/modules/csv-export/v1/datasources/export-api.interface';
import { ExportApi } from '@/modules/csv-export/v1/datasources/export-api.service';
import { Module } from '@nestjs/common';

//todo - do we need this module?
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [HttpErrorFactory, { provide: IExportApi, useClass: ExportApi }],
  exports: [IExportApi],
})
export class ExportApiModule {}
