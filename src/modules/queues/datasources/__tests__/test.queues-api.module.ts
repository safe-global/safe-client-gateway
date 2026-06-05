// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import {
  type IQueueReadiness,
  QueueReadiness,
} from '@/domain/interfaces/queue-readiness.interface';
import { IQueuesApiService } from '@/modules/queues/datasources/queues-api.service.interface';

@Module({
  providers: [
    {
      provide: IQueuesApiService,
      useFactory: (): MockedObject<IQueuesApiService> => {
        return vi.mocked({
          subscribe: vi.fn(),
        });
      },
    },
    {
      provide: QueueReadiness,
      useFactory: (): MockedObject<IQueueReadiness> => {
        return vi.mocked({
          isReady: vi.fn().mockReturnValue(true),
        });
      },
    },
  ],
  exports: [IQueuesApiService, QueueReadiness],
})
export class TestQueuesApiModule {}
