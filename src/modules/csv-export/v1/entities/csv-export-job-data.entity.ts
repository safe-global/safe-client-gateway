import type {
  JobData,
  JobResponse,
} from '@/datasources/job-queue/types/job-types';

export interface CsvExportJobData extends JobData {
  chainId: string;
  safeAddress: `0x${string}`;
  executionDateGte?: string;
  executionDateLte?: string;
  limit?: number;
  offset?: number;
}

export interface CsvExportJobResponse extends JobResponse {
  downloadUrl: string;
}
