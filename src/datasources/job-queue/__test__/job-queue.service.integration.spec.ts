/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Queue } from 'bullmq';
import { QueueEvents } from 'bullmq';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { JobQueueService } from './../job-queue.service';
import { TestJobConsumer } from './../__test__/test.job.consumer';
import { JobType } from './../types/job-types';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type { TestJobData } from '@/datasources/job-queue/__test__/job-queue.service.mock';
import type { RedisClientType } from 'redis';
import { redisClientFactory } from '@/__tests__/redis-client.factory';

describe('JobQueueService & TestJobConsumer integration', () => {
  let service: IJobQueueService;
  let queue: Queue;
  let consumer: TestJobConsumer;
  let redisClient: RedisClientType;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    redisClient = await redisClientFactory();

    moduleRef = await Test.createTestingModule({
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
        TestJobConsumer,
        {
          provide: IJobQueueService,
          useFactory: (queue: Queue): IJobQueueService =>
            new JobQueueService(queue),
          inject: [getQueueToken('test-queue')],
        },
      ],
    }).compile();

    await moduleRef.init();

    service = moduleRef.get(IJobQueueService);
    consumer = moduleRef.get(TestJobConsumer);
    queue = moduleRef.get(getQueueToken('test-queue'));
  });

  afterAll(async () => {
    await queue.close();
    await moduleRef.close();

    await redisClient.quit();
  });

  beforeEach(async () => {
    consumer.handledJobs = [];
    consumer.activeJobs = [];
    consumer.completedJobs = [];
    consumer.failedJobs = [];
    consumer.progressEvents = [];
    consumer.workerErrors = [];

    await queue.drain();
    await redisClient.flushDb();
  });

  it('should process a job added to the queue', async () => {});

  it('should invoke worker event handlers', async () => {});

  it('should handle job failure', async () => {});
});
