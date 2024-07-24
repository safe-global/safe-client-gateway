import { INotificationsDatasource } from '@/domain/interfaces/notifications.datasource.interface';
import { Module } from '@nestjs/common';

const accountsDatasource: INotificationsDatasource = {
  deleteDevice: jest.fn(),
  deleteSubscription: jest.fn(),
  getSafeSubscription: jest.fn(),
  getSubscribersBySafe: jest.fn(),
  upsertSubscriptions: jest.fn(),
};

@Module({
  providers: [
    {
      provide: INotificationsDatasource,
      useFactory: (): jest.MockedObjectDeep<INotificationsDatasource> => {
        return jest.mocked(accountsDatasource);
      },
    },
  ],
  exports: [INotificationsDatasource],
})
export class TestNotificationsDatasourceModule {}
