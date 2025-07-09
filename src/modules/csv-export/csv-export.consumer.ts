import { CSV_EXPORT_QUEUE } from '@/domain/common/entities/jobs.constants';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor(CSV_EXPORT_QUEUE)
export class CsvExportConsumer extends WorkerHost {
  constructor() {
    super();
  }

  process(job: Job): Promise<void> {
    throw new Error(`Job ${job.name} is not implemented yet.`);
  }
}
