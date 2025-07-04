import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { JobStatusResponseDto } from '@/routes/jobs/entities/job-status.dto';

@Injectable()
export class JobsService {
  constructor(
    @Inject(IJobQueueService)
    private readonly jobQueueService: IJobQueueService,
  ) {}

  public async getJobStatus(jobId: string): Promise<JobStatusResponseDto> {
    const job = await this.jobQueueService.getJobStatus(jobId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data as Record<string, unknown>,
      progress: job.progress as
        | number
        | string
        | Record<string, unknown>
        | boolean
        | undefined,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  }
}
