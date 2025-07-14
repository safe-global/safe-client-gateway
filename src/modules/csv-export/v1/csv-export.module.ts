import { CloudStorageModule } from '@/datasources/storage/cloud-storage.module';
import { CsvModule } from '@/modules/csv-export/csv-utils/csv.module';
import { CsvExportService } from '@/modules/csv-export/v1/csv-export.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    CsvModule,
    CloudStorageModule.register(
      'csvExport.fileStorage.aws.bucketName',
      'csvExport.fileStorage.aws.basePath',
    ),
  ],
  providers: [CsvExportService],
  exports: [CsvExportService],
})
export class CsvExportModule {}
