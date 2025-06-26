import { Global, Module } from '@nestjs/common';
import { JobsService } from '@/datasources/jobs/jobs.service';

/**
 * Mock implementation of JobsService for testing
 */
 class MockJobsService {
   // eslint-disable-next-line @typescript-eslint/no-unused-vars
   getJobStatus(_: string): null {
     return null;
   }
 }

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
  providers: [{ provide: JobsService, useClass: MockJobsService }],
  exports: [JobsService],
})
export class TestJobsModule {}