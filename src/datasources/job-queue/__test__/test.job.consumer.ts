import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';
@Processor(JOBS_QUEUE_NAME)
export class TestJobConsumer extends WorkerHost {
  public handledJobs: Array<Job> = [];

  process(job: Job): Promise<string> {
    this.handledJobs.push(job);
    return Promise.resolve(`Processed job: ${job.name}`);
  }
}
