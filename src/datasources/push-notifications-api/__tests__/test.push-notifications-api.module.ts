// SPDX-License-Identifier: FSL-1.1-MIT
import { jest } from 'bun:test';
import { Global, Module } from '@nestjs/common';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import { IPushNotificationsApi } from '#/domain/interfaces/push-notifications-api.interface';

const mockPushNotificationsApi: IPushNotificationsApi = {
  enqueueNotification: jest.fn(),
};

@Global()
@Module({
  providers: [
    {
      provide: IPushNotificationsApi,
      useFactory: (): MockedObject<IPushNotificationsApi> => {
        return mocked(mockPushNotificationsApi);
      },
    },
  ],
  exports: [IPushNotificationsApi],
})
export class TestPushNotificationsApiModule {}
