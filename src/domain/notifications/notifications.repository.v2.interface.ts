import { UpsertSubscriptionsDto } from '@/domain/notifications/entities-v2/upsert-subscriptions.dto.entity';
import { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { PushNotificationsApiModule } from '@/datasources/push-notifications-api/push-notifications-api.module';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { NotificationsRepositoryV2 } from '@/domain/notifications/notifications.repository.v2';
import { Module } from '@nestjs/common';
import { NotificationsDatasourceModule } from '@/datasources/notifications/notifications.datasource.module';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';

export const INotificationsRepositoryV2 = Symbol('INotificationsRepositoryV2');

export interface INotificationsRepositoryV2 {
  enqueueNotification(args: {
    token: string;
    deviceUuid: Uuid;
    notification: FirebaseNotification;
  }): Promise<void>;

  upsertSubscriptions(args: {
    signerAddress: `0x${string}`;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: Uuid;
  }>;

  getSafeSubscription(args: {
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
    signerAddress: `0x${string}`;
  }): Promise<Array<NotificationType>>;

  getSubscribersBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}`;
      deviceUuid: Uuid;
      cloudMessagingToken: string;
    }>
  >;

  deleteSubscription(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    signerAddress: `0x${string}`;
  }): Promise<void>;

  deleteDevice(deviceUuid: Uuid): Promise<void>;
}

@Module({
  imports: [PushNotificationsApiModule, NotificationsDatasourceModule],
  providers: [
    {
      provide: INotificationsRepositoryV2,
      useClass: NotificationsRepositoryV2,
    },
  ],
  exports: [INotificationsRepositoryV2],
})
export class NotificationsRepositoryV2Module {}
