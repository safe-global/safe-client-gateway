import { Module } from '@nestjs/common';
import { CsvModule } from '@/modules/csv-export/csv-utils/csv.module';
import { CsvExportModule as CsvExportV1Module } from '@/modules/csv-export/v1/csv-export.module';

@Module({
  imports: [CsvModule, CsvExportV1Module],
})
export class CsvExportModule {}
