import { Global, Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';

const mockPushNotificationsApi: IPushNotificationsApi = {
  enqueueNotification: vi.fn(),
};

@Global()
@Module({
  providers: [
    {
      provide: IPushNotificationsApi,
      useFactory: (): MockedObject<IPushNotificationsApi> => {
        return vi.mocked(mockPushNotificationsApi);
      },
    },
  ],
  exports: [IPushNotificationsApi],
})
export class TestPushNotificationsApiModule {}
