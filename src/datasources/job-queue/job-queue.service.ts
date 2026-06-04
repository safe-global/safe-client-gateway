// SPDX-License-Identifier: FSL-1.1-MIT

import { Injectable } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import type {
  JobData,
  JobTypeName,
} from '@/datasources/job-queue/types/job-types';
import type { IJobQueueService } from '@/domain/interfaces/job-queue.interface';

@Injectable()
export class JobQueueService implements IJobQueueService {
  constructor(private readonly queue: Queue) {}

  public async getJob(jobId: string): Promise<Job | null> {
    return await this.queue.getJob(jobId);
  }

  public async addJob<T extends JobData>(
    name: JobTypeName,
    data: T,
  ): Promise<Job<T>> {
    const customJobId = crypto.randomUUID();
    return await this.queue.add(name, data, {
      jobId: customJobId,
    });
  }
}
