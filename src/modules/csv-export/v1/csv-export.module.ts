import { Module } from '@nestjs/common';
import { CsvModule } from '@/modules/csv-export/csv-utils/csv.module';
import { CsvExportService } from '@/modules/csv-export/v1/csv-export.service';
import { ExportApiManagerModule } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';
import { CloudStorageModule } from '@/datasources/storage/cloud-storage.module';

@Module({
  imports: [ExportApiManagerModule, CloudStorageModule, CsvModule],
  providers: [CsvExportService],
  exports: [CsvExportService],
})
export class CsvExportModule {}
