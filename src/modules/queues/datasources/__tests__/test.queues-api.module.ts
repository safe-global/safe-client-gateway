// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import {
  type IQueueReadiness,
  QueueReadiness,
} from '@/domain/interfaces/queue-readiness.interface';
import { IQueuesApiService } from '@/modules/queues/datasources/queues-api.service.interface';

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
          isReady: jest.fn().mockReturnValue(true),
        });
      },
    },
  ],
  exports: [IQueuesApiService, QueueReadiness],
})
export class TestQueuesApiModule {}
