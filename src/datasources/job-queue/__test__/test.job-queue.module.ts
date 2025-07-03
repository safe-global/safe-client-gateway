import { Module } from '@nestjs/common';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { mockJobQueueService } from '@/datasources/job-queue/__test__/job-queue.service.mock';
import { TestJobConsumer } from '@/datasources/job-queue/__test__/test.job.consumer';

@Module({
  providers: [
    {
      provide: IJobQueueService,
      useFactory: (): jest.MockedObjectDeep<IJobQueueService> =>
        mockJobQueueService,
    },
    TestJobConsumer,
  ],
  exports: [IJobQueueService],
})
export class TestJobQueueModule {}
