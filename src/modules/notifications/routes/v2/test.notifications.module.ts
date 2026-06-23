// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { NotificationsServiceV2 } from '@/modules/notifications/routes/v2/notifications.service';

const MockedNotificationsServiceV2 = {
  upsertSubscriptions: vi.fn(),
  getSafeSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  deleteDevice: vi.fn(),
} as MockedObject<NotificationsServiceV2>;

@Module({
  providers: [
    {
      provide: NotificationsServiceV2,
      useFactory: (): MockedObject<NotificationsServiceV2> => {
        return vi.mocked(MockedNotificationsServiceV2);
      },
    },
  ],
  exports: [NotificationsServiceV2],
})
export class TestNotificationsModuleV2 {}
