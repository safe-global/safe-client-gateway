import { Global, Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { JobsService } from '@/datasources/jobs/jobs.service';
import { HelloWorldProcessor } from '@/datasources/jobs/processors/hello-world.processor';
import { JOBS_QUEUE_NAME } from '@/datasources/jobs/jobs.constants';
import { LoggingService } from '@/logging/logging.interface';

/**
 * Mock implementation of JobsService for testing
 */
class MockJobsService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getJobStatus(_: string): null {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addHelloWorldJob(_: unknown): Promise<{ id: string }> {
    return Promise.resolve({ id: 'mock-job-id' });
  }
}

/**
 * Mock BullMQ Queue for testing
 */
const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  getJob: jest.fn().mockResolvedValue(null),
};

/**
 * Mock HelloWorldProcessor for testing
 */
class MockHelloWorldProcessor {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_: unknown): Promise<void> {
    // Mock implementation
  }
}

/**
 * Mock LoggingService for testing
 */
const mockLoggingService = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

/**
 * The {@link TestJobsModule} should be used whenever you want to
 * override the values provided by the {@link JobsService}
 *
 * Example:
 * Test.createTestingModule({ imports: [ModuleA, TestJobsModule]}).compile();
 *
 * This will create a TestModule which uses the implementation of ModuleA but
 * overrides the real Jobs Module with a fake one – {@link MockJobsService}
 */
@Global()
@Module({
  providers: [
    { provide: JobsService, useClass: MockJobsService },
    { provide: getQueueToken(JOBS_QUEUE_NAME), useValue: mockQueue },
    { provide: HelloWorldProcessor, useClass: MockHelloWorldProcessor },
    { provide: LoggingService, useValue: mockLoggingService },
  ],
  exports: [JobsService, getQueueToken(JOBS_QUEUE_NAME), HelloWorldProcessor],
})
export class TestJobsModule {}
