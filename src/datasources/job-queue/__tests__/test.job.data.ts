// SPDX-License-Identifier: FSL-1.1-MIT
import type { JobData } from '#/datasources/job-queue/types/job-types';

export interface TestJobData extends JobData {
  message: string;
  timestamp: number;
}
