// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Job } from 'bullmq';
import type { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type {
  JobData,
  JobTypeName,
} from '@/datasources/job-queue/types/job-types';

@Injectable()
export class JobQueueService implements IJobQueueService {
  constructor(@Inject(Queue) private readonly queue: Queue) {}

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
