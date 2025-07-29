import { CsvService } from '@/modules/csv-export/csv-utils/csv.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [CsvService],
  exports: [CsvService],
})
export class CsvModule {}
