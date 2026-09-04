// SPDX-License-Identifier: FSL-1.1-MIT
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  CLOUD_COSIGNER_QUEUE,
  CLOUD_COSIGNER_WORKER_CONCURRENCY,
} from '@/domain/common/jobs.constants';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { CloudCosignerReviewService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-review.service';
import type { CloudCosignerJob } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-job.entity';
import type { ProcessOutcome } from '@/modules/cloud-cosigner/domain/entities/process-outcome.entity';

@Processor(CLOUD_COSIGNER_QUEUE, {
  concurrency: CLOUD_COSIGNER_WORKER_CONCURRENCY,
})
export class CloudCosignerConsumer extends WorkerHost {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CloudCosignerReviewService)
    private readonly reviewService: CloudCosignerReviewService,
  ) {
    super();
  }

  process(job: CloudCosignerJob): Promise<ProcessOutcome> {
    if (job.name !== JobType.CLOUD_COSIGNER_REVIEW) {
      throw new Error(`Unknown job type: ${job.name}`);
    }
    return this.reviewService.processReview(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: CloudCosignerJob | undefined, error: Error): void {
    this.loggingService.error({
      type: LogType.CloudCosignerReview,
      message: `Review job failed: ${asError(error).message}`,
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      ...job?.data,
    });
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.loggingService.error({
      type: LogType.CloudCosignerReview,
      message: `Worker error: ${asError(error).message}`,
    });
  }
}
