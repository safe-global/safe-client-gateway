import { UpsertSubscriptionsDto } from '@/domain/notifications/entities-v2/upsert-subscriptions.dto.entity';
import { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { INotificationsDatasource } from '@/domain/interfaces/notifications.datasource.interface';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { INotificationsRepositoryV2 } from '@/domain/notifications/notifications.repository.v2.interface';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { IDelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository.interface';

@Injectable()
export class NotificationsRepositoryV2 implements INotificationsRepositoryV2 {
  constructor(
    @Inject(IPushNotificationsApi)
    private readonly pushNotificationsApi: IPushNotificationsApi,
    @Inject(INotificationsDatasource)
    private readonly notificationsDatasource: INotificationsDatasource,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IDelegatesV2Repository)
    private readonly delegatesRepository: IDelegatesV2Repository,
  ) {}

  enqueueNotification(
    token: string,
    notification: FirebaseNotification,
  ): Promise<void> {
    return this.pushNotificationsApi.enqueueNotification(token, notification);
  }

  async upsertSubscriptions(args: UpsertSubscriptionsDto): Promise<{
    deviceUuid: Uuid;
  }> {
    const authorizedSafesToSubscribe: UpsertSubscriptionsDto['safes'] = [];

    // Only allow owners or delegates to subscribe to notifications
    // We don't Promise.all getSafe/getDelegates to prevent unnecessary calls
    for (const safeToSubscribe of args.safes) {
      const safe = await this.safeRepository
        .getSafe({
          chainId: safeToSubscribe.chainId,
          address: safeToSubscribe.address,
        })
        .catch(() => null);

      // Upsert owner
      if (safe && safe.owners.includes(args.account)) {
        authorizedSafesToSubscribe.push(safeToSubscribe);
        continue;
      }

      const delegates = await this.delegatesRepository
        .getDelegates({
          chainId: safeToSubscribe.chainId,
          safeAddress: safeToSubscribe.address,
          delegate: args.account,
        })
        .catch(() => null);

      // Upsert delegate
      if (
        delegates &&
        delegates.results.some(({ delegate }) => delegate === args.account)
      ) {
        authorizedSafesToSubscribe.push(safeToSubscribe);
      }
    }

    if (authorizedSafesToSubscribe.length === 0) {
      throw new UnauthorizedException();
    }

    return this.notificationsDatasource.upsertSubscriptions({
      ...args,
      safes: authorizedSafesToSubscribe,
    });
  }

  getSafeSubscription(args: {
    account: `0x${string}`;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<unknown> {
    return this.notificationsDatasource.getSafeSubscription(args);
  }

  getSubscribersWithTokensBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}`;
      cloudMessagingToken: string;
    }>
  > {
    return this.notificationsDatasource.getSubscribersWithTokensBySafe(args);
  }

  deleteSubscription(args: {
    account: `0x${string}`;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    return this.notificationsDatasource.deleteSubscription(args);
  }

  deleteDevice(deviceUuid: Uuid): Promise<void> {
    return this.notificationsDatasource.deleteDevice(deviceUuid);
  }
}
