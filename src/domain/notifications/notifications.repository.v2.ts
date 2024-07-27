import { UpsertSubscriptionsDto } from '@/domain/notifications/entities-v2/upsert-subscriptions.dto.entity';
import { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { INotificationsDatasource } from '@/domain/interfaces/notifications.datasource.interface';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { INotificationsRepositoryV2 } from '@/domain/notifications/notifications.repository.v2.interface';
import {
  Inject,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { IDelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { NotificationType } from '@/domain/notifications/entities-v2/notification.entity';
import { get } from 'lodash';

@Injectable()
export class NotificationsRepositoryV2 implements INotificationsRepositoryV2 {
  /**
   * Firebase REST error message for the HTTP v1 API relevant to token registration:
   *
   * This error can be caused by missing registration tokens, or unregistered tokens.
   *
   * Missing Registration: If the message's target is a token value, check that the
   * request contains a registration token.
   *
   * Not registered: An existing registration token may cease to be valid in a number
   * of scenarios, including:
   * - If the client app unregisters with FCM.
   * - If the client app is automatically unregistered, which can happen if the user
   *   uninstalls the application. For example, on iOS, if the APNs Feedback Service
   *   reported the APNs token as invalid.
   * - If the registration token expires (for example, Google might decide to refresh
   *   registration tokens, or the APNs token has expired for iOS devices).
   * - If the client app is updated but the new version is not configured to receive
   *   messages.
   *
   * For all these cases, remove this registration token from the app server and stop
   * using it to send messages.
   *
   * @see https://firebase.google.com/docs/cloud-messaging/send-message#rest
   */
  static readonly UnregisteredErrorCode = 404;
  static readonly UnregisteredErrorStatus = 'UNREGISTERED';

  constructor(
    @Inject(IPushNotificationsApi)
    private readonly pushNotificationsApi: IPushNotificationsApi,
    @Inject(INotificationsDatasource)
    private readonly notificationsDatasource: INotificationsDatasource,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IDelegatesV2Repository)
    private readonly delegatesRepository: IDelegatesV2Repository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async enqueueNotification(args: {
    token: string;
    deviceUuid: Uuid;
    notification: FirebaseNotification;
  }): Promise<void> {
    try {
      await this.pushNotificationsApi.enqueueNotification(
        args.token,
        args.notification,
      );
    } catch (e) {
      if (this.isTokenUnregistered(e)) {
        await this.deleteDevice(args.deviceUuid).catch(() => null);
      } else {
        this.loggingService.info(`Failed to enqueue notification: ${e}`);
        throw new UnprocessableEntityException();
      }
    }
  }

  private isTokenUnregistered(error: unknown): boolean {
    const isNotFound =
      get(error, 'code') === NotificationsRepositoryV2.UnregisteredErrorCode;
    const isUnregistered =
      get(error, 'status') ===
      NotificationsRepositoryV2.UnregisteredErrorStatus;
    return isNotFound && isUnregistered;
  }

  async upsertSubscriptions(args: UpsertSubscriptionsDto): Promise<{
    deviceUuid: Uuid;
  }> {
    // Only allow owners or delegates to subscribe to notifications
    // We don't Promise.all getSafe/getDelegates to prevent unnecessary calls
    for (const safeToSubscribe of args.safes) {
      const safe = await this.safeRepository.getSafe({
        chainId: safeToSubscribe.chainId,
        address: safeToSubscribe.address,
      });

      const isOwner = !!safe?.owners.includes(args.account);
      if (isOwner) {
        continue;
      }

      const delegates = await this.delegatesRepository.getDelegates({
        chainId: safeToSubscribe.chainId,
        safeAddress: safeToSubscribe.address,
        delegate: args.account,
      });

      const isDelegate = !!delegates?.results.some((delegate) => {
        return (
          delegate.delegate === args.account &&
          delegate.safe === safeToSubscribe.address
        );
      });
      if (isDelegate) {
        continue;
      }

      this.loggingService.info(
        `Non-owner/delegate ${args.account} tried to subscribe to Safe ${safeToSubscribe.address}`,
      );
      throw new UnauthorizedException();
    }

    return this.notificationsDatasource.upsertSubscriptions(args);
  }

  getSafeSubscription(args: {
    account: `0x${string}`;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationType>> {
    return this.notificationsDatasource.getSafeSubscription(args);
  }

  getSubscribersBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}`;
      deviceUuid: Uuid;
      cloudMessagingToken: string;
    }>
  > {
    return this.notificationsDatasource.getSubscribersBySafe(args);
  }

  deleteSubscription(args: {
    account: `0x${string}`;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    return this.notificationsDatasource.deleteSubscription(args);
  }

  deleteDevice(deviceUuid: Uuid): Promise<void> {
    return this.notificationsDatasource.deleteDevice(deviceUuid);
  }
}
