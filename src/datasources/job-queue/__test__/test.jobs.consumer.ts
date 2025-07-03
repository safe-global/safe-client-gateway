import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';

@Processor(JOBS_QUEUE_NAME)
export class TestJobQueueProcessor extends WorkerHost {
  process(job: Job): Promise<void> {
    throw new Error(`Not implemented yet for ${job.name}.`);
  }
}
