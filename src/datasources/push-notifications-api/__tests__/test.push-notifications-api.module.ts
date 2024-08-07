import { Global, Module } from '@nestjs/common';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';

const mockPushNotificationsApi: IPushNotificationsApi = {
  enqueueNotification: jest.fn(),
};

@Global()
@Module({
  providers: [
    {
      provide: IPushNotificationsApi,
      useFactory: (): jest.MockedObjectDeep<IPushNotificationsApi> => {
        return jest.mocked(mockPushNotificationsApi);
      },
    },
  ],
  exports: [IPushNotificationsApi],
})
export class TestPushNotificationsApiModule {}
