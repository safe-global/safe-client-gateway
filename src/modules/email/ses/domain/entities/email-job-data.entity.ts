// SPDX-License-Identifier: FSL-1.1-MIT
import type { JobData } from '@/datasources/job-queue/types/job-types';

export interface SendEmailJobData extends JobData {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  metadata?: Record<string, unknown>;
}
