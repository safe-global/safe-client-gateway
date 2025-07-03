import { JobType } from '@/datasources/job-queue/types/job-types';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor(JOBS_QUEUE_NAME)
export class JobConsumer extends WorkerHost {
  constructor() {
    super();
  }

  process(job: Job): Promise<void> {
    switch (job.name) {
      case JobType.CSV_EXPORT:
        throw new Error('Job is not implemented yet.');
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }
}
