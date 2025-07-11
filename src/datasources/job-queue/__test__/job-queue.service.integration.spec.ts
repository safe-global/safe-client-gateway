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
  public handlers: Array<(job: Job) => Promise<string>> = [];

  async add(name: string, data: TestJobData): Promise<Job> {
    const job = { name, data } as Job;
    for (const handler of this.handlers) {
      await handler(job);
    }
    return job;
  }
}

describe('JobQueueService & TestJobConsumer integration', () => {
  let service: IJobQueueService;
  let queue: InMemoryQueue;
  let consumer: TestJobConsumer;

  beforeEach(async () => {
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
    queue.handlers.push((job) => consumer.process(job));
  });

  it('should process a job added to the queue', async () => {
    const data = { message: 'hello', timestamp: 0 } as TestJobData;

    const job = await service.addJob(JobType.TEST_JOB, data);

    expect(consumer.handledJobs).toContain(job);

    const processedJob = consumer.handledJobs[0];
    expect(processedJob.name).toBe(JobType.TEST_JOB);
    expect(processedJob.data).toEqual(data);
  });
});
