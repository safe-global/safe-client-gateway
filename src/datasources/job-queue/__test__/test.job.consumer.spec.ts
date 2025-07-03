import type { Job } from 'bullmq';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { TestJobConsumer } from '@/datasources/job-queue/__test__/test.job.consumer';

describe('TestJobConsumer', () => {
  let consumer: TestJobConsumer;

  beforeEach(() => {
    consumer = new TestJobConsumer();
  });

  it('should store processed jobs', async () => {
    const job = { name: JobType.CSV_EXPORT } as unknown as Job;

    await expect(consumer.process(job)).resolves.toEqual(
      'Processed job: csv-export',
    );
    expect(consumer.handledJobs).toContain(job);
  });

  it('should accumulate multiple jobs', async () => {
    const job1 = { name: JobType.CSV_EXPORT, data: { a: 1 } } as unknown as Job;
    const job2 = { name: JobType.CSV_EXPORT, data: { a: 2 } } as unknown as Job;

    await consumer.process(job1);
    await consumer.process(job2);

    expect(consumer.handledJobs).toEqual([job1, job2]);
  });
});
