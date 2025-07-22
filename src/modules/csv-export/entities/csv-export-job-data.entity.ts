import type { JobData } from '@/datasources/job-queue/types/job-types';

export interface CsvExportJobData extends JobData {
  message: string;
}
