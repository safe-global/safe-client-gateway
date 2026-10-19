// SPDX-License-Identifier: FSL-1.1-MIT
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { JobType } from '#/datasources/job-queue/types/job-types';
import { SAFENET_CHECKS_QUEUE } from '#/domain/common/jobs.constants';
import type { SafenetCheckJobData } from '#/modules/safenet/domain/entities/safenet-check-job-data.entity';

@Injectable()
export class SafenetChecksQueue implements OnModuleInit {
  constructor(
    @InjectQueue(SAFENET_CHECKS_QUEUE)
    private readonly queue: Queue<SafenetCheckJobData>,
  ) {}

  /** All jobs share the payer Safe nonce, so none may run beside another on any replica. */
  public async onModuleInit(): Promise<void> {
    await this.queue.setGlobalConcurrency(1);
  }

  /** True while a job exists for this transaction, so a repeat request adds nothing. */
  public async has(data: SafenetCheckJobData): Promise<boolean> {
    return (await this.queue.getJob(this.jobIdOf(data))) !== undefined;
  }

  /** The job ID makes a repeated transaction a no-op, so the fee is paid once. */
  public async enqueue(data: SafenetCheckJobData): Promise<void> {
    await this.queue.add(JobType.SAFENET_CHECK, data, {
      jobId: this.jobIdOf(data),
    });
  }

  /** The documented job ID, with the chain ID in canonical form: every caller must agree on it. */
  public jobIdOf(data: SafenetCheckJobData): string {
    return `${BigInt(data.chainId)}-${data.safe}-${data.safeTxHash}`.toLowerCase();
  }
}
