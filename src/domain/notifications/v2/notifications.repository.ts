import { UpsertSubscriptionsDto } from '@/domain/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { UUID } from 'crypto';
import type { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import get from 'lodash/get';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { NotificationSubscription } from '@/datasources/notifications/entities/notification-subscription.entity.db';
import { NotificationDevice } from '@/datasources/notifications/entities/notification-devices.entity.db';
import { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';
import { EntityManager, In, IsNull } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { NotificationSubscriptionNotificationType } from '@/datasources/notifications/entities/notification-subscription-notification-type.entity.db';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';

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
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  public async enqueueNotification(args: {
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
        await this.deleteDevice(args.deviceUuid)
          // No need to log as datasource does
          .catch(() => null);
      } else {
        throw new UnprocessableEntityException(
          `Failed to enqueue notification, ${e}`,
        );
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

  public async upsertSubscriptions(args: {
    authPayload: AuthPayload;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: UUID;
  }> {
    const deviceUuid = await this.postgresDatabaseService.transaction(
      async (entityManager: EntityManager): Promise<UUID> => {
        await this.removeGetSubscribersBySafeCache({
          entityManager,
          safes: args.upsertSubscriptionsDto.safes,
        });
        const device = await this.upsertDevice(entityManager, args);
        await this.deletePreviousSubscriptions(entityManager, {
          deviceId: device.id,
          signerAddress: args.authPayload.signer_address,
          upsertSubscriptionsDto: args.upsertSubscriptionsDto,
        });

        const subscriptions = await this.upsertSubscription(entityManager, {
          ...args,
          deviceId: device.id,
        });

        await this.insertSubscriptionNotificationTypes(entityManager, {
          subscriptions,
          upsertSubscriptionsDto: args.upsertSubscriptionsDto,
        });

        return device.device_uuid;
      },
    );

    return { deviceUuid };
  }

  private async upsertDevice(
    entityManager: EntityManager,
    args: {
      authPayload: AuthPayload;
      upsertSubscriptionsDto: UpsertSubscriptionsDto;
    },
  ): Promise<Pick<NotificationDevice, 'id' | 'device_uuid'>> {
    const deviceUuid =
      args.upsertSubscriptionsDto.deviceUuid ?? crypto.randomUUID();

    await entityManager.upsert(
      NotificationDevice,
      {
        device_uuid: deviceUuid,
        device_type: args.upsertSubscriptionsDto.deviceType,
        cloud_messaging_token: args.upsertSubscriptionsDto.cloudMessagingToken,
      },
      {
        conflictPaths: ['device_uuid'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    const device = await entityManager.findOneOrFail(NotificationDevice, {
      where: { device_uuid: deviceUuid },
    });

    return { id: device.id, device_uuid: deviceUuid };
  }

  private async deletePreviousSubscriptions(
    entityManager: EntityManager,
    args: {
      deviceId: number;
      signerAddress?: `0x${string}`;
      upsertSubscriptionsDto: UpsertSubscriptionsDto;
    },
  ): Promise<void> {
    for (const safe of args.upsertSubscriptionsDto.safes) {
      await entityManager
        .createQueryBuilder()
        .delete()
        .from(NotificationSubscription)
        .where(
          `chain_id = :chainId
          AND safe_address = :safeAddress
          AND push_notification_device.id = :deviceId
          AND (
            signer_address = :signerAddress OR signer_address IS NULL
          )`,
          {
            chainId: safe.chainId,
            safeAddress: safe.address,
            deviceId: args.deviceId,
            signerAddress: args.signerAddress ?? null,
          },
        )
        .execute();
    }
  }

  private async upsertSubscription(
    entityManager: EntityManager,
    args: {
      authPayload: AuthPayload;
      upsertSubscriptionsDto: UpsertSubscriptionsDto;
      deviceId: number;
    },
  ): Promise<Array<NotificationSubscription>> {
    const subscriptionsToInsert: Array<Partial<NotificationSubscription>> = [];
    for (const safe of args.upsertSubscriptionsDto.safes) {
      const device = new NotificationDevice();
      device.id = args.deviceId;
      subscriptionsToInsert.push({
        chain_id: safe.chainId,
        safe_address: safe.address,
        signer_address: args.authPayload.signer_address ?? null,
        push_notification_device: device,
      });
    }

    const insertResult = await entityManager.upsert(
      NotificationSubscription,
      subscriptionsToInsert,
      {
        conflictPaths: [
          'chain_id',
          'safe_address',
          'signer_address',
          'push_notification_device',
        ],
        skipUpdateIfNoValuesChanged: true,
      },
    );
    const subscriptionIds: Array<number> = insertResult.identifiers.map(
      (subscriptionIdentifier) => subscriptionIdentifier.id,
    );

    const subscriptions = await this.getSubscriptionsById(
      entityManager,
      subscriptionIds,
    );

    return subscriptions;
  }

  private async getSubscriptionsById(
    entityManager: EntityManager,
    subscriptionIds: Array<number>,
  ): Promise<Array<NotificationSubscription>> {
    return await entityManager.find(NotificationSubscription, {
      where: { id: In(subscriptionIds) },
    });
  }

  private async getSubscriptionsByDeviceUuid(
    deviceUuid: UUID,
  ): Promise<Array<NotificationSubscription>> {
    const notificationsSubscriptionsRepository =
      await this.postgresDatabaseService.getRepository<NotificationSubscription>(
        NotificationSubscription,
      );
    return await notificationsSubscriptionsRepository.find({
      where: { push_notification_device: { device_uuid: deviceUuid } },
    });
  }

  private async insertSubscriptionNotificationTypes(
    entityManager: EntityManager,
    arg: {
      upsertSubscriptionsDto: UpsertSubscriptionsDto;
      subscriptions: Array<NotificationSubscription>;
    },
  ): Promise<void> {
    const notificationTypesMap = new Map<string, NotificationType>(); // A map of all the notification types in request along with their database entity
    const notificationTypes = arg.upsertSubscriptionsDto.safes.flatMap(
      (safe) => safe.notificationTypes,
    );
    const uniqueNotificationTypes = new Set(notificationTypes);

    const notificationTypeObjects = await entityManager.find(NotificationType, {
      where: { name: In([...uniqueNotificationTypes]) },
    });

    for (const notificationTypeObject of notificationTypeObjects) {
      notificationTypesMap.set(
        notificationTypeObject.name,
        notificationTypeObject,
      );
    }

    const subscriptionNotificationTypes = [];
    for (const safe of arg.upsertSubscriptionsDto.safes) {
      const safeSubscription = arg.subscriptions.find(
        (subscriptions) =>
          subscriptions.chain_id === safe.chainId &&
          subscriptions.safe_address === safe.address,
      );

      for (const notificationType of safe.notificationTypes) {
        subscriptionNotificationTypes.push({
          notification_subscription: safeSubscription,
          notification_type: notificationTypesMap.get(notificationType),
        });
      }
    }

    await entityManager.upsert(
      NotificationSubscriptionNotificationType,
      subscriptionNotificationTypes,
      {
        conflictPaths: ['notification_subscription', 'notification_type'],
        skipUpdateIfNoValuesChanged: true,
      },
    );
  }

  public async getSafeSubscription(args: {
    authPayload: AuthPayload;
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationType>> {
    if (!args.authPayload.signer_address) {
      throw new UnauthorizedException();
    }

    const notificationTypeRepository =
      await this.postgresDatabaseService.getRepository(NotificationType);

    return await notificationTypeRepository.find({
      select: {
        name: true,
      },
      where: {
        notification_subscription_notification_type: {
          notification_subscription: {
            push_notification_device: {
              device_uuid: args.deviceUuid,
            },
            chain_id: args.chainId,
            safe_address: args.safeAddress,
            signer_address: args.authPayload.signer_address,
          },
        },
      },
    });
  }

  public async getSubscribersBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}` | null;
      deviceUuid: UUID;
      cloudMessagingToken: string;
    }>
  > {
    const notificationSubscriptionRepository =
      await this.postgresDatabaseService.getRepository<NotificationSubscription>(
        NotificationSubscription,
      );

    const cacheTtl = this.configurationService.getOrThrow<number>(
      'pushNotifications.getSubscribersBySafeTtlMilliseconds',
    );

    const subscriptionsCacheKey = this.getSubscribersBySafeCacheKey({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
    const subscriptions = await notificationSubscriptionRepository.find({
      where: {
        chain_id: args.chainId,
        safe_address: args.safeAddress,
      },
      relations: ['push_notification_device'],
      cache: {
        id: subscriptionsCacheKey,
        milliseconds: cacheTtl,
      },
    });

    const output: Array<{
      subscriber: `0x${string}` | null;
      deviceUuid: UUID;
      cloudMessagingToken: string;
    }> = [];

    for (const subscription of subscriptions) {
      output.push({
        subscriber: subscription.signer_address,
        deviceUuid: subscription.push_notification_device.device_uuid,
        cloudMessagingToken:
          subscription.push_notification_device.cloud_messaging_token,
      });
    }

    return output;
  }

  public async deleteSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const notificationsSubscriptionsRepository =
      await this.postgresDatabaseService.getRepository<NotificationSubscription>(
        NotificationSubscription,
      );
    const subscription = await notificationsSubscriptionsRepository.findOne({
      where: {
        chain_id: args.chainId,
        safe_address: args.safeAddress,
        push_notification_device: {
          device_uuid: args.deviceUuid,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No Subscription Found!');
    }

    await notificationsSubscriptionsRepository.remove(subscription);
    await this.removeGetSubscribersBySafeCache({
      entityManager: notificationsSubscriptionsRepository.manager,
      safes: [{ chainId: args.chainId, address: args.safeAddress }],
    });
  }

  public async deleteAllSubscriptions(args: {
    subscriptions: Array<{
      chainId: string;
      deviceUuid: UUID;
      safeAddress: `0x${string}`;
      signerAddress?: `0x${string}` | null;
    }>;
  }): Promise<void> {
    const notificationsSubscriptionsRepository =
      await this.postgresDatabaseService.getRepository<NotificationSubscription>(
        NotificationSubscription,
      );
    const whereConditions = args.subscriptions.map((subscription) => {
      const baseCondition = {
        chain_id: subscription.chainId,
        safe_address: subscription.safeAddress,
        push_notification_device: {
          device_uuid: subscription.deviceUuid,
        },
      };

      // Handle signerAddress: undefined (omitted) vs null (explicit) vs string (specific address)
      return subscription.signerAddress === undefined
        ? baseCondition
        : {
            ...baseCondition,
            signer_address:
              subscription.signerAddress === null
                ? IsNull()
                : subscription.signerAddress,
          };
    });
    const subscriptions = await notificationsSubscriptionsRepository.find({
      where: whereConditions,
    });

    if (!subscriptions.length) {
      throw new NotFoundException('No Subscription Found!');
    }

    await notificationsSubscriptionsRepository.remove(subscriptions);
    for (const subscription of subscriptions) {
      await this.removeGetSubscribersBySafeCache({
        entityManager: notificationsSubscriptionsRepository.manager,
        safes: [
          {
            chainId: subscription.chain_id,
            address: subscription.safe_address,
          },
        ],
      });
    }
  }

  public async deleteDevice(deviceUuid: UUID): Promise<void> {
    const notificationsDeviceRepository =
      await this.postgresDatabaseService.getRepository<NotificationDevice>(
        NotificationDevice,
      );

    const subscriptions = await this.getSubscriptionsByDeviceUuid(deviceUuid);
    const deleteResult = await notificationsDeviceRepository.delete({
      device_uuid: deviceUuid,
    });

    if (!deleteResult.affected) {
      throw new NotFoundException('No Device Found!');
    }

    await this.removeGetSubscribersBySafeCache({
      entityManager: notificationsDeviceRepository.manager,
      safes: subscriptions.map((subscription) => ({
        chainId: subscription.chain_id,
        address: subscription.safe_address,
      })),
    });
  }

  private getSubscribersBySafeCacheKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return CacheRouter.getOrnCacheKey(
      'getSubscribersBySafe',
      args.chainId,
      args.safeAddress,
    );
  }

  private async removeGetSubscribersBySafeCache(args: {
    entityManager: EntityManager;
    safes: Array<{ chainId: string; address: `0x${string}` }>;
  }): Promise<void> {
    for (const safe of args.safes) {
      const subscriptionsCacheKey = this.getSubscribersBySafeCacheKey({
        chainId: safe.chainId,
        safeAddress: safe.address,
      });

      await args.entityManager.connection.queryResultCache?.remove([
        subscriptionsCacheKey,
      ]);
    }
  }
}
