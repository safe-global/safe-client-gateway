// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type { SendEmailJobData } from '@/modules/email/ses/domain/entities/email-job-data.entity';

@Injectable()
export class SesEmailQueueService {
  constructor(
    @Inject(IJobQueueService)
    private readonly jobQueueService: IJobQueueService,
  ) {}

  async enqueue(data: SendEmailJobData): Promise<void> {
    await this.jobQueueService.addJob(JobType.SEND_EMAIL, data);
  }
}
