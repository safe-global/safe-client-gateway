import type { Job } from 'bullmq';
import { TestJobConsumer } from '@/datasources/job-queue/__test__/test.job.consumer';
import { faker } from '@faker-js/faker/.';
import type { TestJobData } from '@/datasources/job-queue/__test__/job-queue.service.mock';

describe('TestJobConsumer', () => {
  let consumer: TestJobConsumer;

  beforeEach(() => {
    consumer = new TestJobConsumer();
  });

  it('should store processed jobs', async () => {
    const job = {
      name: 'test-job',
      data: { message: faker.lorem.word(), timestamp: 0 },
      updateProgress: jest.fn(),
    } as unknown as Job<TestJobData>;

    await expect(consumer.process(job)).resolves.toEqual(
      'Processed job: test-job',
    );
    expect(consumer.handledJobs).toContain(job);
  });

  it('should accumulate multiple jobs', async () => {
    const job1 = {
      name: 'test-job',
      data: { message: faker.lorem.word(), timestamp: 0 },
      updateProgress: jest.fn(),
    } as unknown as Job<TestJobData>;
    const job2 = {
      name: 'test-job',
      data: { message: faker.lorem.word(), timestamp: 0 },
      updateProgress: jest.fn(),
    } as unknown as Job<TestJobData>;

    await consumer.process(job1);
    await consumer.process(job2);

    expect(consumer.handledJobs).toEqual([job1, job2]);
  });

  it('should record worker events', () => {
    const job = { name: 'test-job' } as Job;
    const error = new Error('oops');

    consumer.onActive(job);
    consumer.onProgress(job, 50);
    consumer.onCompleted(job, 'done');
    consumer.onFailed(job, error);
    consumer.onWorkerError(error);

    expect(consumer.activeJobs).toContain(job);
    expect(consumer.progressEvents).toContainEqual({ job, progress: 50 });
    expect(consumer.completedJobs).toContainEqual({ job, result: 'done' });
    expect(consumer.failedJobs).toContainEqual({ job, error });
    expect(consumer.workerErrors).toContain(error);
  });
});
