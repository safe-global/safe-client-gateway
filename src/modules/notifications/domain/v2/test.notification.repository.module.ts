// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { MockNotificationRepositoryV2 } from '@/modules/notifications/domain/v2/entities/__tests__/notification.repository.mock';
import { INotificationsRepositoryV2 } from '@/modules/notifications/domain/v2/notifications.repository.interface';

@Module({
  providers: [
    {
      provide: INotificationsRepositoryV2,
      useFactory: (): MockedObject<INotificationsRepositoryV2> => {
        return vi.mocked(MockNotificationRepositoryV2);
      },
    },
  ],
  exports: [INotificationsRepositoryV2],
})
export class TestNotificationsRepositoryV2Module {}
