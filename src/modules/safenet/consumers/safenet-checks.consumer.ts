// SPDX-License-Identifier: FSL-1.1-MIT
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import { LogType } from '#/domain/common/entities/log-type.entity';
import { SAFENET_CHECKS_QUEUE } from '#/domain/common/jobs.constants';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import type { SafenetCheckJobData } from '#/modules/safenet/domain/entities/safenet-check-job-data.entity';
import { SafenetPayerError } from '#/modules/safenet/domain/errors/safenet-payer.error';
import { SafenetPayer } from '#/modules/safenet/domain/safenet-payer';

const SOURCE = 'SafenetChecksConsumer';

// A stalled job may have paid its fee, so it fails instead of running again.
@Processor(SAFENET_CHECKS_QUEUE, { maxStalledCount: 0 })
export class SafenetChecksConsumer extends WorkerHost {
  constructor(
    private readonly payer: SafenetPayer,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    super();
  }

  /** Retries only a SafenetPayerError; other errors may follow a paid fee and fail the job. */
  async process(job: Job<SafenetCheckJobData>): Promise<void> {
    try {
      const { chainId, safe, transaction } = job.data;
      const result = await this.payer.propose({ chainId, safe, transaction });
      this.loggingService.info({
        type: LogType.JobEvent,
        source: SOURCE,
        event: `Job ${job.id} proposed`,
        safeTxHash: job.data.safeTxHash,
        transactionHash: result.transactionHash,
        payerNonce: result.payerNonce.toString(),
      });
    } catch (error) {
      if (error instanceof SafenetPayerError) {
        throw error;
      }
      throw new UnrecoverableError(asError(error).message);
    }
  }

  /** A job out of attempts after `SafenetPayerError` paid nothing, so it leaves the queue and the next signature can queue it again. */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<SafenetCheckJobData>, error: Error): Promise<void> {
    this.loggingService.error({
      type: LogType.JobError,
      source: SOURCE,
      event: `Job ${job.id} failed: ${error.message}`,
      attemptsMade: job.attemptsMade,
      chainId: job.data.chainId,
      safe: job.data.safe,
      safeTxHash: job.data.safeTxHash,
    });
    if (
      error instanceof SafenetPayerError &&
      job.attemptsMade >= (job.opts.attempts ?? 1)
    ) {
      await job.remove().catch((cause: unknown) =>
        this.loggingService.error({
          type: LogType.JobError,
          source: SOURCE,
          event: `Job ${job.id} could not be removed: ${asError(cause).message}`,
        }),
      );
    }
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.loggingService.error({
      type: LogType.JobError,
      source: SOURCE,
      event: `Worker encountered an error: ${error.message}`,
    });
  }
}
