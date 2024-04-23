import { IQueuesApiService } from '@/datasources/queues/queues-api.service.interface';
import {
  IQueueReadiness,
  QueueReadiness,
} from '@/domain/interfaces/queue-readiness.interface';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: IQueuesApiService,
      useFactory: (): jest.MockedObjectDeep<IQueuesApiService> => {
        return jest.mocked({
          subscribe: jest.fn(),
        });
      },
    },
    {
      provide: QueueReadiness,
      useFactory: (): jest.MockedObjectDeep<IQueueReadiness> => {
        return jest.mocked({
          isReady: jest.fn(),
        });
      },
    },
  ],
  exports: [IQueuesApiService, QueueReadiness],
})
export class TestQueuesApiModule {}
