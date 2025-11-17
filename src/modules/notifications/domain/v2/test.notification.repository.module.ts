import { Module } from '@nestjs/common';
import { INotificationsRepositoryV2 } from '@/modules/notifications/domain/v2/notifications.repository.interface';
import { MockNotificationRepositoryV2 } from '@/modules/notifications/domain/v2/entities/__tests__/notification.repository.mock';

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
