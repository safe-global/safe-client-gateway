import type { Queue } from 'bullmq';
import { Test } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { JobQueueService } from './../job-queue.service';
import { TestJobConsumer } from './../__tests__/test.job.consumer';
import { JobType } from './../types/job-types';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type { TestJobData } from '@/datasources/job-queue/__tests__/test.job.data';
import { faker } from '@faker-js/faker/.';
import type { INestApplication } from '@nestjs/common';

describe('JobQueueService & TestJobConsumer integration', () => {
  let app: INestApplication;
  let service: IJobQueueService;
  let queue: Queue;
  let consumer: TestJobConsumer;

  const FIXED_TEST_TIME = new Date('2024-01-01T12:00:00Z').getTime();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            username: process.env.REDIS_USER,
            password: process.env.REDIS_PASS,
          },
        }),
        BullModule.registerQueue({
          name: 'test-queue',
        }),
      ],
      providers: [
        {
          provide: IJobQueueService,
          useFactory: (queue: Queue): IJobQueueService =>
            new JobQueueService(queue),
          inject: [getQueueToken('test-queue')],
        },
        TestJobConsumer,
      ],
    }).compile();

    service = moduleFixture.get<IJobQueueService>(IJobQueueService);
    consumer = moduleFixture.get(TestJobConsumer);
    queue = moduleFixture.get(getQueueToken('test-queue'));

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    consumer.cleanup();
    await (await queue.client).flushdb();
    await queue.drain(true);
  });

  afterAll(async () => {
    await queue.close();
    await app.close();
  });

  it('should process a job added to the queue', async () => {
    const data = {
      message: faker.lorem.word(),
      timestamp: FIXED_TEST_TIME,
    } as TestJobData;

    await service.addJob(JobType.TEST_JOB, data);

    // Wait for job to be processed
    await waitUntil(() => consumer.handledJobs.length === 1);

    expect(consumer.handledJobs).toHaveLength(1);

    const processedJob = consumer.handledJobs[0];
    expect(processedJob.name).toBe(JobType.TEST_JOB);
    expect(processedJob.data).toEqual(data);
  });

  it('should invoke worker event handlers', async () => {
    const data = {
      message: faker.lorem.word(),
      timestamp: FIXED_TEST_TIME,
    } as TestJobData;

    await service.addJob(JobType.TEST_JOB, data);

    await waitUntil(() => consumer.handledJobs.length === 1);

    const processedJob = consumer.handledJobs[0];
    expect(processedJob.name).toBe(JobType.TEST_JOB);
    expect(processedJob.data).toEqual(data);

    expect(consumer.activeJobs).toContain(processedJob);
    expect(consumer.progressEvents).toContainEqual({
      job: processedJob,
      progress: 50,
    });
    expect(consumer.completedJobs).toContainEqual({
      job: processedJob,
      result: `Processed job: ${JobType.TEST_JOB}`,
    });
    expect(consumer.failedJobs).toHaveLength(0);
    expect(consumer.workerErrors).toHaveLength(0);
  });

  it('should process multiple jobs and preserve order', async () => {
    const jobs = Array.from({ length: 3 }, (_, i) => ({
      message: faker.lorem.word(),
      timestamp: FIXED_TEST_TIME + i, // Increment to ensure unique timestamps
    })) as Array<TestJobData>;

    for (const data of jobs) {
      await service.addJob(JobType.TEST_JOB, data);
    }

    await waitUntil(() => consumer.handledJobs.length === jobs.length);

    for (let i = 0; i < jobs.length; i++) {
      expect(consumer.handledJobs[i].data).toEqual(jobs[i]);
    }
  });

  it('should handle job failure', async () => {
    const data: TestJobData = { message: 'THROW_ERROR', timestamp: FIXED_TEST_TIME };

    await service.addJob(JobType.TEST_JOB, data);

    await waitUntil(() => consumer.failedJobs.length === 1, 10000);

    expect(consumer.handledJobs).toHaveLength(1);
    expect(consumer.failedJobs[0].error?.message).toEqual('Job failed');
    expect(consumer.completedJobs).toHaveLength(0);
  });
});

async function waitUntil(
  condition: () => boolean,
  timeout = 10000, // Increased timeout to reduce flakiness
  interval = 100, // Slightly longer interval to reduce CPU usage
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    // Use promisified setTimeout for better async handling
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
