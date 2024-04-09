import { IQueueConsumerService } from '@/datasources/queues/queue-consumer.service.interface';
import {
  IQueueReadiness,
  QueueReadiness,
} from '@/domain/interfaces/queue-readiness.interface';
import { Module } from '@nestjs/common';

const queueConsumerService = {
  subscribe: jest.fn(),
  isReady: jest.fn(),
} as jest.MockedObjectDeep<IQueueConsumerService>;

const queueReadiness = {
  isReady: jest.fn(),
} as jest.MockedObjectDeep<IQueueReadiness>;

@Module({
  providers: [
    {
      provide: IQueueConsumerService,
      useFactory: (): jest.MockedObjectDeep<IQueueConsumerService> => {
        return jest.mocked(queueConsumerService);
      },
    },
    {
      provide: QueueReadiness,
      useFactory: (): jest.MockedObjectDeep<IQueueReadiness> => {
        return jest.mocked(queueReadiness);
      },
    },
  ],
  exports: [IQueueConsumerService, QueueReadiness],
})
export class TestQueueConsumerModule {}
