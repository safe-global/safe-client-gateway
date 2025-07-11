import { Injectable } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { JobData, JobTypeName } from '@/datasources/job-queue/types/job-types';

@Injectable()
export class JobQueueService implements IJobQueueService {
  constructor(private readonly queue: Queue) {}

  public async getJobStatus(jobId: string): Promise<Job | null> {
    return this.queue.getJob(jobId);
  }

  public async addJob(name: JobTypeName, data: JobData): Promise<Job> {
    return this.queue.add(name, data);
  }
}
