import { Module } from '@nestjs/common';
import { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import { MockNotificationRepositoryV2 } from '@/domain/notifications/v2/test.notification.repository.interface';

@Module({
  providers: [
    {
      provide: INotificationsRepositoryV2,
      useFactory: (): jest.MockedObjectDeep<INotificationsRepositoryV2> => {
        return jest.mocked(MockNotificationRepositoryV2);
      },
    },
  ],
  exports: [INotificationsRepositoryV2],
})
export class TestNotificationsRepositoryV2Module {}
