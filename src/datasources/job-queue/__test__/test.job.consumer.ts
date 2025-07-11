import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('test-queue')
export class TestJobConsumer extends WorkerHost {
  public handledJobs: Array<Job> = [];

  process(job: Job): Promise<string> {
    this.handledJobs.push(job);
    return Promise.resolve(`Processed job: ${job.name}`);
  }
}
