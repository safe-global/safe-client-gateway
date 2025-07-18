import type { Job, Queue } from 'bullmq';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { JobQueueService } from './../job-queue.service';
import { TestJobConsumer } from './../__test__/test.job.consumer';
import { JobType } from './../types/job-types';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type { TestJobData } from '@/datasources/job-queue/__test__/job-queue.service.mock';

// This is a simple in-memory queue implementation to simulate job processing without an actual queue system.
class InMemoryQueue {
  public handler?: {
    process: (job: Job) => Promise<unknown>;
    onActive?: (job: Job) => void;
    onProgress?: (job: Job, progress: number) => void;
    onCompleted?: (job: Job, result: unknown) => void;
    onFailed?: (job: Job, error: Error) => void;
    onWorkerError?: (error: Error) => void;
  };

  async add(name: string, data: TestJobData): Promise<Job> {
    const job = { name, data } as Job;
    const handler = this.handler;
    if (handler) {
      try {
        handler.onActive?.(job);
        handler.onProgress?.(job, 50);
        const result = await handler.process(job);
        handler.onCompleted?.(job, result);
      } catch (error) {
        handler.onFailed?.(job, error as Error);
        handler.onWorkerError?.(error as Error);
      }
    }
    return job;
  }
}

describe('JobQueueService & TestJobConsumer integration', () => {
  let service: IJobQueueService;
  let queue: InMemoryQueue;
  let consumer: TestJobConsumer;

  beforeEach(async () => {
    jest.resetAllMocks();

    queue = new InMemoryQueue();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TestJobConsumer,
        {
          provide: IJobQueueService,
          useFactory: (queue: Queue): IJobQueueService =>
            new JobQueueService(queue),
          inject: [getQueueToken('test-queue')],
        },
        {
          provide: getQueueToken('test-queue'),
          useValue: queue,
        },
      ],
    }).compile();

    service = moduleRef.get(IJobQueueService);
    consumer = moduleRef.get(TestJobConsumer);
    queue.handler = consumer;
  });

  it('should process a job added to the queue', async () => {
    const data = { message: 'hello', timestamp: 0 } as TestJobData;
    const job = await service.addJob(JobType.TEST_JOB, data);

    expect(consumer.handledJobs).toContain(job);

    const processedJob = consumer.handledJobs[0];
    expect(processedJob.name).toBe(JobType.TEST_JOB);
    expect(processedJob.data).toEqual(data);
  });

  it('should invoke worker event handlers', async () => {
    const data = { message: 'hello', timestamp: 0 } as TestJobData;
    const job = await service.addJob(JobType.TEST_JOB, data);

    expect(consumer.activeJobs).toContain(job);
    expect(consumer.progressEvents).toContainEqual({ job, progress: 50 });
    expect(consumer.completedJobs).toContainEqual({
      job,
      result: `Processed job: ${JobType.TEST_JOB}`,
    });
    expect(consumer.failedJobs).toHaveLength(0);
    expect(consumer.workerErrors).toHaveLength(0);
  });

  it('should handle job failure', async () => {
    const errorJob = {
      name: JobType.TEST_JOB,
      data: {},
    } as Job;

    const error = new Error('Job failed');
    jest.spyOn(consumer, 'process').mockImplementationOnce(() => {
      throw error;
    });

    await service.addJob(JobType.TEST_JOB, errorJob.data as TestJobData);

    expect(consumer.failedJobs).toContainEqual({
      job: errorJob,
      error,
    });
  });
});
