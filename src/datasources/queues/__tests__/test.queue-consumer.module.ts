import { IQueuesApiService } from '@/datasources/queues/queues-api.service.interface';
import { Module } from '@nestjs/common';

const queuesApiService = {
  subscribe: jest.fn(),
  isReady: jest.fn(),
} as jest.MockedObjectDeep<IQueuesApiService>;

@Module({
  providers: [
    {
      provide: IQueuesApiService,
      useFactory: (): jest.MockedObjectDeep<IQueuesApiService> => {
        return jest.mocked(queuesApiService);
      },
    },
  ],
  exports: [IQueuesApiService],
})
export class TestQueuesApiModule {}
