import { IQueuesApiService } from '@/datasources/queues/queues-api.service.interface';
import {
  IQueueReadiness,
  QueueReadiness,
} from '@/domain/interfaces/queue-readiness.interface';
import { Module } from '@nestjs/common';

const queuesApiService = {
  subscribe: jest.fn(),
} as jest.MockedObjectDeep<IQueuesApiService>;

const queueReadiness = {
  isReady: jest.fn(),
} as jest.MockedObjectDeep<IQueueReadiness>;

@Module({
  providers: [
    {
      provide: IQueuesApiService,
      useFactory: (): jest.MockedObjectDeep<IQueuesApiService> => {
        return jest.mocked(queuesApiService);
      },
    },
    {
      provide: QueueReadiness,
      useFactory: (): jest.MockedObjectDeep<IQueueReadiness> => {
        return jest.mocked(queueReadiness);
      },
    },
  ],
  exports: [IQueuesApiService, QueueReadiness],
})
export class TestQueuesApiModule {}
