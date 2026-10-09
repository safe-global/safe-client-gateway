// SPDX-License-Identifier: FSL-1.1-MIT
import { jest } from 'bun:test';
import { Module } from '@nestjs/common';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import { NotificationsServiceV2 } from '#/modules/notifications/routes/v2/notifications.service';

const MockedNotificationsServiceV2 = {
  upsertSubscriptions: jest.fn(),
  getSafeSubscription: jest.fn(),
  deleteSubscription: jest.fn(),
  deleteDevice: jest.fn(),
} as MockedObject<NotificationsServiceV2>;

@Module({
  providers: [
    {
      provide: NotificationsServiceV2,
      useFactory: (): MockedObject<NotificationsServiceV2> => {
        return mocked(MockedNotificationsServiceV2);
      },
    },
  ],
  exports: [NotificationsServiceV2],
})
export class TestNotificationsModuleV2 {}
