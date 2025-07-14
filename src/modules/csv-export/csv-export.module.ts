import { CsvExportService } from '@/modules/csv-export/csv-export.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [CsvExportService],
  exports: [CsvExportService],
})
export class CsvExportModule {}
