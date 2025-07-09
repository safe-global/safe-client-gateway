import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CSV_EXPORT_QUEUE } from '@/domain/common/entities/jobs.constants';
@Processor(CSV_EXPORT_QUEUE)
export class TestJobConsumer extends WorkerHost {
  public handledJobs: Array<Job> = [];

  process(job: Job): Promise<string> {
    this.handledJobs.push(job);
    return Promise.resolve(`Processed job: ${job.name}`);
  }
}
