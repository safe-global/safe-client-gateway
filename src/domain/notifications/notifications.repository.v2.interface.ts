import { UpsertSubscriptionsDto } from '@/domain/notifications/entities-v2/upsert-subscriptions.dto.entity';
import { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { PushNotificationsApiModule } from '@/datasources/push-notifications-api/push-notifications-api.module';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { NotificationsRepositoryV2 } from '@/domain/notifications/notifications.repository.v2';
import { Module } from '@nestjs/common';
import { NotificationsDatasourceModule } from '@/datasources/accounts/notifications/notifications.datasource.module';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { DelegatesV2RepositoryModule } from '@/domain/delegate/v2/delegates.v2.repository.interface';

export const INotificationsRepositoryV2 = Symbol('INotificationsRepositoryV2');

export interface INotificationsRepositoryV2 {
  enqueueNotification(
    token: string,
    notification: FirebaseNotification,
  ): Promise<void>;

  upsertSubscriptions(args: UpsertSubscriptionsDto): Promise<{
    deviceUuid: Uuid;
  }>;

  getSafeSubscription(args: {
    account: `0x${string}`;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<unknown>;

  getSubscribersWithTokensBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}`;
      cloudMessagingToken: string;
    }>
  >;

  deleteSubscription(args: {
    account: `0x${string}`;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  deleteDevice(deviceUuid: Uuid): Promise<void>;
}

@Module({
  imports: [
    PushNotificationsApiModule,
    NotificationsDatasourceModule,
    SafeRepositoryModule,
    DelegatesV2RepositoryModule,
  ],
  providers: [
    {
      provide: INotificationsRepositoryV2,
      useClass: NotificationsRepositoryV2,
    },
  ],
  exports: [INotificationsRepositoryV2],
})
export class NotificationsRepositoryV2Module {}
