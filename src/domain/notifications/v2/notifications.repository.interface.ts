import { UpsertSubscriptionsDto } from '@/routes/notifications/v1/entities/upsert-subscriptions.dto.entity';
import { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { PushNotificationsApiModule } from '@/datasources/push-notifications-api/push-notifications-api.module';
import { UUID } from 'crypto';
import { NotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository';
import { Module } from '@nestjs/common';
import { NotificationsDatasourceModule } from '@/datasources/notifications/notifications.datasource.module';
import { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';

export const INotificationsRepositoryV2 = Symbol('INotificationsRepositoryV2');

export interface INotificationsRepositoryV2 {
  enqueueNotification(args: {
    token: string;
    deviceUuid: UUID;
    notification: FirebaseNotification;
  }): Promise<void>;

  upsertSubscriptions(args: {
    authPayload: AuthPayload;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: UUID;
  }>;

  getSafeSubscription(args: {
    authPayload: AuthPayload;
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationType>>;

  getSubscribersBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}` | null;
      deviceUuid: UUID;
      cloudMessagingToken: string;
    }>
  >;

  deleteSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  deleteDevice(deviceUuid: UUID): Promise<void>;
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
