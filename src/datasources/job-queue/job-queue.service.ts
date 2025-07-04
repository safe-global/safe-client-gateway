import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { JobData, JobTypeName } from '@/datasources/job-queue/types/job-types';

@Injectable()
export class JobQueueService implements IJobQueueService {
  constructor(@InjectQueue(JOBS_QUEUE_NAME) private readonly queue: Queue) {}

  public async getJobStatus(jobId: string): Promise<Job | null> {
    return this.queue.getJob(jobId);
  }

  public async addJob(name: JobTypeName, data: JobData): Promise<Job> {
    return this.queue.add(name, data);
  }
}
