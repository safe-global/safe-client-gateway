import type { Job } from 'bullmq';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { JobQueueService } from './../job-queue.service';
import { TestJobConsumer } from './../__test__/test.job.consumer';
import { JobType } from './../types/job-types';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';

// This is a simple in-memory queue implementation to simulate job processing without an actual queue system.
class InMemoryQueue {
  public handlers: Array<(job: Job) => Promise<string>> = [];

  async add(name: string, data: object): Promise<Job> {
    const job = { name, data } as unknown as Job;
    for (const handler of this.handlers) {
      await handler(job);
    }
    return job;
  }
}

describe('JobQueueService & TestJobConsumer integration', () => {
  let service: JobQueueService;
  let queue: InMemoryQueue;
  let consumer: TestJobConsumer;

  beforeEach(async () => {
    queue = new InMemoryQueue();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TestJobConsumer,
        JobQueueService,
        {
          provide: getQueueToken(JOBS_QUEUE_NAME),
          useValue: queue,
        },
      ],
    }).compile();

    service = moduleRef.get(JobQueueService);
    consumer = moduleRef.get(TestJobConsumer);
    queue.handlers.push((job) => consumer.process(job));
  });

  it('should process a job added to the queue', async () => {
    const data = { 'csv-export': { message: 'hello', timestamp: 0 } };

    const job = await service.addJob(JobType.CSV_EXPORT, data);

    expect(consumer.handledJobs).toContain(job);
  });
});
