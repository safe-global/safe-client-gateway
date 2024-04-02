import { IQueueConsumerService } from '@/datasources/queues/queue-consumer.service.interface';
import { Module } from '@nestjs/common';

const queueConsumerService = {
  subscribe: jest.fn(),
} as jest.MockedObjectDeep<IQueueConsumerService>;

@Module({
  providers: [
    {
      provide: IQueueConsumerService,
      useFactory: (): jest.MockedObjectDeep<IQueueConsumerService> => {
        return jest.mocked(queueConsumerService);
      },
    },
  ],
  exports: [IQueueConsumerService],
})
export class TestQueueConsumerModule {}
