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

  process(job: Job): Promise<string> {
    this.handledJobs.push(job);
    return Promise.resolve(`Processed job: ${job.name}`);
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
}
