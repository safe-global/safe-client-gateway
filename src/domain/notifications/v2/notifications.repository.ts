import { UpsertSubscriptionsDto } from '@/routes/notifications/v1/entities/upsert-subscriptions.dto.entity';
import { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { INotificationsDatasource } from '@/domain/interfaces/notifications.datasource.interface';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { UUID } from 'crypto';
import { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import {
  Inject,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { NotificationType } from '@/domain/notifications/v2/entities/notification.entity';
import { get } from 'lodash';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';

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
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async enqueueNotification(args: {
    token: string;
    deviceUuid: UUID;
    notification: FirebaseNotification;
  }): Promise<void> {
    try {
      await this.pushNotificationsApi.enqueueNotification(
        args.token,
        args.notification,
      );
    } catch (e) {
      if (this.isTokenUnregistered(e)) {
        this.loggingService.info(
          `Deleting device due to stale token ${args.deviceUuid}: ${e}`,
        );
        await this.notificationsDatasource
          .deleteDevice(args.deviceUuid)
          // No need to log as datasource does
          .catch(() => null);
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

  async upsertSubscriptions(args: {
    authPayload: AuthPayload;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: UUID;
  }> {
    return this.notificationsDatasource.upsertSubscriptions({
      signerAddress: args.authPayload.signer_address,
      upsertSubscriptionsDto: args.upsertSubscriptionsDto,
    });
  }

  getSafeSubscription(args: {
    authPayload: AuthPayload;
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationType>> {
    if (!args.authPayload.signer_address) {
      throw new UnauthorizedException();
    }

    return this.notificationsDatasource.getSafeSubscription({
      signerAddress: args.authPayload.signer_address,
      deviceUuid: args.deviceUuid,
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
  }

  getSubscribersBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}` | null;
      deviceUuid: UUID;
      cloudMessagingToken: string;
    }>
  > {
    return this.notificationsDatasource.getSubscribersBySafe({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
  }

  deleteSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    return this.notificationsDatasource.deleteSubscription(args);
  }

  deleteDevice(deviceUuid: UUID): Promise<void> {
    return this.notificationsDatasource.deleteDevice(deviceUuid);
  }
}
