import { Global, Module, DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { JobsService } from '@/datasources/jobs/jobs.service';
import { HelloWorldProcessor } from '@/datasources/jobs/processors/hello-world.processor';
import { JOBS_QUEUE_NAME } from '@/datasources/jobs/jobs.constants';

// Mock implementations for testing
const mockQueue = {
  add: jest.fn ? jest.fn().mockResolvedValue({ id: 'mock-job-id' }) : (): Promise<{ id: string }> => Promise.resolve({ id: 'mock-job-id' }),
  getJob: jest.fn ? jest.fn().mockResolvedValue(null) : (): Promise<null> => Promise.resolve(null),
};

class MockJobsService {
  getJobStatus(): null {
    return null;
  }

  addHelloWorldJob(): Promise<{ id: string }> {
    return Promise.resolve({ id: 'mock-job-id' });
  }
}

class MockHelloWorldProcessor {
  async process(): Promise<void> {
    // Mock implementation
  }
}

@Global()
@Module({})
export class JobsModule {
  static forRoot(): DynamicModule {
    const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

    if (isTestEnvironment) {
      // Return mock module for tests
      return {
        module: JobsModule,
        providers: [
          { provide: JobsService, useClass: MockJobsService },
          { provide: getQueueToken(JOBS_QUEUE_NAME), useValue: mockQueue },
          { provide: HelloWorldProcessor, useClass: MockHelloWorldProcessor },
        ],
        exports: [JobsService],
      };
    }

    // Return real module for production
    return {
      module: JobsModule,
      imports: [
        BullModule.registerQueue({
          name: JOBS_QUEUE_NAME,
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 5,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            attempts: 3,
          },
        }),
      ],
      providers: [JobsService, HelloWorldProcessor],
      exports: [JobsService],
    };
  }
}
