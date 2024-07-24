import { UpsertSubscriptionsDto } from '@/domain/notifications/entities-v2/upsert-subscriptions.dto.entity';
import { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { PushNotificationsApiModule } from '@/datasources/push-notifications-api/push-notifications-api.module';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { NotificationsRepositoryV2 } from '@/domain/notifications/notifications.repository.v2';
import { DynamicModule, Module } from '@nestjs/common';
import { NotificationsDatasourceModule } from '@/datasources/accounts/notifications/notifications.datasource.module';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { DelegatesV2RepositoryModule } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';

export const INotificationsRepositoryV2 = Symbol('INotificationsRepositoryV2');

export interface INotificationsRepositoryV2 {
  enqueueNotification(args: {
    token: string;
    deviceUuid: Uuid;
    notification: FirebaseNotification;
  }): Promise<void>;

  upsertSubscriptions(args: UpsertSubscriptionsDto): Promise<{
    deviceUuid: Uuid;
  }>;

  getSafeSubscription(args: {
    account: `0x${string}`;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
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
    account: `0x${string}`;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  deleteDevice(deviceUuid: Uuid): Promise<void>;
}

/**
 * The following is used for feature flagging. All functions are noops in order
 * to not require database access when push notifications are disabled.
 */
class NoopNotificationsRepositoryV2 implements INotificationsRepositoryV2 {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  enqueueNotification(_args: {
    token: string;
    deviceUuid: string;
    notification: FirebaseNotification;
  }): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  upsertSubscriptions(_args: UpsertSubscriptionsDto): Promise<{
    deviceUuid: Uuid;
  }> {
    return Promise.resolve({ deviceUuid: crypto.randomUUID() });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSafeSubscription(_args: {
    account: `0x${string}`;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationType>> {
    return Promise.resolve([]);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSubscribersBySafe(_args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}`;
      deviceUuid: Uuid;
      cloudMessagingToken: string;
    }>
  > {
    return Promise.resolve([]);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteSubscription(_args: {
    account: `0x${string}`;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteDevice(_deviceUuid: Uuid): Promise<void> {
    return Promise.resolve();
  }
}

@Module({})
export class NotificationsRepositoryV2Module {
  static forRoot(config: typeof configuration): DynamicModule {
    const isPushNotificationsEnabled = config().features.pushNotifications;

    if (!isPushNotificationsEnabled) {
      return {
        module: NotificationsRepositoryV2Module,
        imports: [],
        providers: [
          {
            provide: INotificationsRepositoryV2,
            useClass: NoopNotificationsRepositoryV2,
          },
        ],
        exports: [INotificationsRepositoryV2],
      };
    }

    return {
      module: NotificationsRepositoryV2Module,
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
    };
  }
}
