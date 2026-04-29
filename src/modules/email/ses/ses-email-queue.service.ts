// SPDX-License-Identifier: FSL-1.1-MIT
import { JobType } from '@/datasources/job-queue/types/job-types';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type { SendEmailJobData } from '@/modules/email/ses/domain/entities/email-job-data.entity';
import { Inject, Injectable } from '@nestjs/common';

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
