import type {
  JobData,
  JobResponse,
} from '@/datasources/job-queue/types/job-types';
import type { Address } from 'viem';

export interface CsvExportJobData extends JobData {
  chainId: string;
  safeAddress: Address;
  executionDateGte?: string;
  executionDateLte?: string;
  limit?: number;
  offset?: number;
}

export interface CsvExportJobResponse extends JobResponse {
  downloadUrl: string;
}
