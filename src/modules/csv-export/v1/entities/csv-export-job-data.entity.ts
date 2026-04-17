// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type {
  JobData,
  JobResponse,
} from '@/datasources/job-queue/types/job-types';

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
