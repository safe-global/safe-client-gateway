import { type TestJobData } from '@/datasources/job-queue/__tests__/test.job.data';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('test-queue')
export class TestJobConsumer extends WorkerHost {
  public handledJobs: Array<Job> = [];
  public activeJobs: Array<Job> = [];
  public completedJobs: Array<{ job: Job; result: unknown }> = [];
  public failedJobs: Array<{ job: Job; error: Error }> = [];
  public progressEvents: Array<{ job: Job; progress: number }> = [];
  public workerErrors: Array<Error> = [];

  async process(job: Job<TestJobData>): Promise<string> {
    this.handledJobs.push(job);

    // Special condition to test job failure
    if (job.data?.message === 'THROW_ERROR') {
      throw new Error('Job failed');
    }

    await job.updateProgress(50);
    return `Processed job: ${job.name}`;
  }

  @OnWorkerEvent('active')
  onActive(job: Job): void {
    this.activeJobs.push(job);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number): void {
    this.progressEvents.push({ job, progress });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: unknown): void {
    this.completedJobs.push({ job, result });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.failedJobs.push({ job, error });
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.workerErrors.push(error);
  }

  public cleanup(): void {
    this.handledJobs.length = 0;
    this.activeJobs.length = 0;
    this.completedJobs.length = 0;
    this.failedJobs.length = 0;
    this.progressEvents.length = 0;
    this.workerErrors.length = 0;
  }
}
