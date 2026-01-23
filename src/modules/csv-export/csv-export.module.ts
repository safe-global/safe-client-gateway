import { Module } from '@nestjs/common';
import { CsvService } from '@/modules/csv-export/csv-utils/csv.service';
import { CsvExportV1Module } from '@/modules/csv-export/v1/csv-export.module';

@Module({
  imports: [CsvExportV1Module],
  providers: [CsvService],
  exports: [CsvService],
})
export class CsvExportModule {}
