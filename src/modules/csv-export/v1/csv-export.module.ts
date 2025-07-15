import { CloudStorageModule } from '@/datasources/storage/cloud-storage.module';
import { CsvModule } from '@/modules/csv-export/csv-utils/csv.module';
import { CsvExportService } from '@/modules/csv-export/v1/csv-export.service';
import { ExportApiManagerModule } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    CsvModule,
    ExportApiManagerModule,
    CloudStorageModule.register(
      'csvExport.fileStorage.aws.bucketName',
      'csvExport.fileStorage.aws.basePath',
    ),
  ],
  providers: [CsvExportService],
  exports: [CsvExportService],
})
export class CsvExportModule {}
