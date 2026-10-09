// SPDX-License-Identifier: FSL-1.1-MIT

import { jest } from 'bun:test';
import { Module } from '@nestjs/common';
import type { MockedObject } from '#/__tests__/mocks';
import {
  type IQueueReadiness,
  QueueReadiness,
} from '#/domain/interfaces/queue-readiness.interface';
import { IQueuesApiService } from '#/modules/queues/datasources/queues-api.service.interface';

@Module({
  providers: [
    {
      provide: IQueuesApiService,
      useFactory: (): MockedObject<IQueuesApiService> => {
        return {
          subscribe: jest.fn(),
        } as MockedObject<IQueuesApiService>;
      },
    },
    {
      provide: QueueReadiness,
      useFactory: (): MockedObject<IQueueReadiness> => {
        return {
          isReady: jest.fn().mockReturnValue(true),
        } as MockedObject<IQueueReadiness>;
      },
    },
  ],
  exports: [IQueuesApiService, QueueReadiness],
})
export class TestQueuesApiModule {}
