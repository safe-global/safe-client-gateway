import { NotificationType as DomainNotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { INotificationsDatasource } from '@/domain/interfaces/notifications.datasource.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import postgres from 'postgres';
import { NotificationChannel as DomainNotificationChannel } from '@/domain/notifications/entities-v2/notification-channel.entity';
import { UpsertSubscriptionsDto } from '@/datasources/accounts/notifications/entities/upsert-subscriptions.dto.entity';

@Injectable()
export class NotificationsDatasource implements INotificationsDatasource {
  constructor(
    @Inject('DB_INSTANCE')
    private readonly sql: postgres.Sql,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IAccountsDatasource)
    private readonly accountsDatasource: IAccountsDatasource,
  ) {}

  /**
   * Upserts subscriptions for the given account/device as per the list of Safes
   * and notification types provided.
   *
   * @param args.account Account address
   * @param args.cloudMessagingToken Cloud messaging token
   * @param args.deviceType Device type
   * @param args.deviceUuid Device UUID (defaults to random UUID)
   * @param args.safes List of Safes with notification types
   *
   * @returns Device UUID
   */
  async upsertSubscriptions(
    args: UpsertSubscriptionsDto,
  ): Promise<{ deviceUuid: Uuid }> {
    const account = await this.accountsDatasource.getAccount(args.account);
    const deviceUuid = args.deviceUuid ?? crypto.randomUUID();

    await this.sql.begin(async (sql) => {
      // Get the push notifications channel
      const [channel] = await sql<[{ id: number }]>`
        SELECT id FROM notification_channels
        WHERE name = ${DomainNotificationChannel.PUSH_NOTIFICATIONS}
      `.catch((e) => {
        const error = 'Error getting channel';
        this.loggingService.info(`${error}: ${asError(e).message}`);
        throw new NotFoundException(error);
      });

      // Insert (or update the cloud messaging token of) a device
      const [device] = await sql<[{ id: number }]>`
        INSERT INTO notification_devices (account_id, device_type, device_uuid, cloud_messaging_token)
        VALUES (${account.id}, ${args.deviceType}, ${deviceUuid}, ${args.cloudMessagingToken})
        ON CONFLICT (device_uuid)
        DO UPDATE SET
          cloud_messaging_token = EXCLUDED.cloud_messaging_token,
          -- Throws if updated_at is not set
          updated_at = NOW()
        RETURNING id
      `.catch((e) => {
        const error = 'Error getting device';
        this.loggingService.info(`${error}: ${asError(e).message}`);
        throw new UnprocessableEntityException(error);
      });

      // For each Safe, upsert the subscription and overwrite the subscribed-to notification types
      await Promise.all(
        args.safes.map(async (safe) => {
          try {
            // 1. Upsert subscription
            const [subscription] = await sql<[{ id: number }]>`
              INSERT INTO notification_subscriptions (account_id, chain_id, safe_address, device_id, notification_channel_id)
              VALUES (${account.id}, ${safe.chainId}, ${safe.address}, ${device.id}, ${channel.id})
              ON CONFLICT (account_id, chain_id, safe_address, device_id, notification_channel_id)
                -- A field must be set to return the id
                DO UPDATE SET updated_at = NOW()
              RETURNING id
            `;
            // 2. Remove existing subscribed-to notification types
            await sql`
              DELETE FROM notification_subscription_notification_types
              WHERE notification_subscription_id = ${subscription.id}
            `;
            // 3. Insert new subscribed-to notification types
            await sql`
              INSERT INTO notification_subscription_notification_types (notification_subscription_id, notification_type_id)
              SELECT ${subscription.id}, id
              FROM notification_types
              WHERE name = ANY(${safe.notificationTypes})
            `;
          } catch (e) {
            const error = 'Error upserting subscription';
            this.loggingService.info(`${error}: ${asError(e).message}`);
            throw new NotFoundException();
          }
        }),
      );
    });

    return { deviceUuid };
  }

  /**
   * Gets notification preferences for given account/device for the given Safe.
   *
   * @param args.account Account address
   * @param args.deviceUuid Device UUID
   * @param args.chainId Chain ID
   * @param args.safeAddress Safe address
   *
   * @returns List of {@link DomainNotificationType} notifications subscribed to
   */
  async getSafeSubscription(args: {
    account: `0x${string}`;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<DomainNotificationType>> {
    const account = await this.accountsDatasource.getAccount(args.account);

    const notificationTypes = await this.sql<
      Array<{ name: DomainNotificationType }>
    >`
      SELECT nt.name 
      FROM notification_subscriptions ns
      JOIN notification_devices nd ON ns.device_id = nd.id
      JOIN notification_subscription_notification_types nsnt ON ns.id = nsnt.notification_subscription_id
      JOIN notification_types nt ON nsnt.notification_type_id = nt.id
      WHERE ns.account_id = ${account.id}
        AND ns.chain_id = ${args.chainId}
        AND ns.safe_address = ${args.safeAddress}
        AND nd.device_uuid = ${args.deviceUuid}
    `.catch((e) => {
      const error = 'Error getting subscription or notification types';
      this.loggingService.info(`${error}: ${asError(e).message}`);
      throw new NotFoundException(error);
    });

    return notificationTypes.map((notificationType) => notificationType.name);
  }

  /**
   * Gets subscribers and their cloud messaging tokens for the given Safe.
   *
   * @param args.chainId Chain ID
   * @param args.safeAddress Safe address
   *
   * @returns List of subscribers/tokens for given Safe
   */
  async getSubscribersWithTokensBySafe(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<
    Array<{
      subscriber: `0x${string}`;
      cloudMessagingToken: string;
    }>
  > {
    const subscribers = await this.sql<
      Array<{ address: `0x${string}`; cloud_messaging_token: string }>
    >`
      SELECT a.address, nd.cloud_messaging_token
      FROM notification_subscriptions ns
      JOIN accounts a ON ns.account_id = a.id
      JOIN notification_devices nd ON ns.device_id = nd.id
      WHERE ns.chain_id = ${args.chainId}
        AND ns.safe_address = ${args.safeAddress}
    `.catch((e) => {
      const error = 'Error getting subscribers with tokens';
      this.loggingService.info(`${error}: ${asError(e).message}`);
      throw new NotFoundException(error);
    });

    return subscribers.map((subscriber) => {
      return {
        subscriber: subscriber.address,
        cloudMessagingToken: subscriber.cloud_messaging_token,
      };
    });
  }

  /**
   * Deletes the Safe subscription for the given account/device.
   *
   * @param args.account Account address
   * @param args.deviceUuid Device UUID
   * @param args.chainId Chain ID
   * @param args.safeAddress Safe address
   */
  async deleteSubscription(args: {
    account: `0x${string}`;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    await this.sql`
      DELETE FROM notification_subscriptions ns
      USING accounts a, notification_devices nd
      WHERE ns.account_id = a.id
        AND ns.device_id = nd.id
        AND a.address = ${args.account}
        AND nd.device_uuid = ${args.deviceUuid}
        AND ns.chain_id = ${args.chainId}
        AND ns.safe_address = ${args.safeAddress}
    `.catch((e) => {
      const error = 'Error deleting subscription';
      this.loggingService.info(`${error}: ${asError(e).message}`);
      throw new UnprocessableEntityException(error);
    });
  }

  /**
   * Deletes subscriptions for the given device UUID.
   *
   * @param deviceUuid Device UUID
   */
  async deleteDevice(deviceUuid: Uuid): Promise<void> {
    await this.sql`
      DELETE FROM notification_devices
      WHERE device_uuid = ${deviceUuid}
    `.catch((e) => {
      const error = 'Error deleting device';
      this.loggingService.info(`${error}: ${asError(e).message}`);
      throw new UnprocessableEntityException(error);
    });
  }
}
