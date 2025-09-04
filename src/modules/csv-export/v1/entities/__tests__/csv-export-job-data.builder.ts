import { faker } from '@faker-js/faker';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type {
  CsvExportJobData,
  CsvExportJobResponse,
} from '@/modules/csv-export/v1/entities/csv-export-job-data.entity';
import type { Address } from 'viem';

export function csvExportJobDataBuilder(): IBuilder<CsvExportJobData> {
  return new Builder<CsvExportJobData>()
    .with('chainId', faker.string.numeric(1))
    .with('safeAddress', faker.finance.ethereumAddress() as Address)
    .with('executionDateGte', faker.date.past().toISOString().split('T')[0])
    .with('executionDateLte', faker.date.recent().toISOString().split('T')[0])
    .with('limit', faker.number.int({ min: 1, max: 100 }))
    .with('offset', faker.number.int({ min: 0, max: 50 }));
}

export function csvExportJobResponseBuilder(): IBuilder<CsvExportJobResponse> {
  return new Builder<CsvExportJobResponse>().with(
    'downloadUrl',
    faker.internet.url(),
  );
}
