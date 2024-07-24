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
import { asError } from '@/logging/utils';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { NotificationType } from '@/domain/notifications/entities-v2/notification.entity';

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
  static readonly UnregisteredErrorMessage = 'UNREGISTERED';

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
      return this.pushNotificationsApi.enqueueNotification(
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

  private isTokenUnregistered(e: unknown): boolean {
    return (
      asError(e).message === NotificationsRepositoryV2.UnregisteredErrorMessage
    );
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
