import type { Job, Queue } from 'bullmq';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { JobQueueService } from './../job-queue.service';
import { TestJobConsumer } from './../__test__/test.job.consumer';
import { JobType } from './../types/job-types';
import { CSV_EXPORT_QUEUE } from '@/domain/common/entities/jobs.constants';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';

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
          inject: [getQueueToken(CSV_EXPORT_QUEUE)],
        },
        {
          provide: getQueueToken(CSV_EXPORT_QUEUE),
          useValue: queue,
        },
      ],
    }).compile();

    service = moduleRef.get(IJobQueueService);
    consumer = moduleRef.get(TestJobConsumer);
    queue.handlers.push((job) => consumer.process(job));
  });

  it('should process a job added to the queue', async () => {
    const data = { 'csv-export': { message: 'hello', timestamp: 0 } };

    const job = await service.addJob(JobType.CSV_EXPORT, data);

    expect(consumer.handledJobs).toContain(job);
  });
});
