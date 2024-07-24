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
    upsertSubscriptionsDto: UpsertSubscriptionsDto,
  ): Promise<{ deviceUuid: Uuid }> {
    const account = await this.accountsDatasource.getAccount(
      upsertSubscriptionsDto.account,
    );
    const deviceUuid = upsertSubscriptionsDto.deviceUuid ?? crypto.randomUUID();

    await this.sql.begin(async (sql) => {
      // Insert (or update the type/cloud messaging token of) a device
      const [device] = await sql<[{ id: number }]>`
        INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token)
        VALUES (${upsertSubscriptionsDto.deviceType}, ${deviceUuid}, ${upsertSubscriptionsDto.cloudMessagingToken})
        ON CONFLICT (device_uuid)
        DO UPDATE SET
          cloud_messaging_token = EXCLUDED.cloud_messaging_token,
          device_type = EXCLUDED.device_type,
          -- If updated_at is not set ON CONFLICT, an error is thrown meaning nothing is returned
          updated_at = NOW()
        RETURNING id
      `.catch((e) => {
        const error = 'Error getting device';
        this.loggingService.info(`${error}: ${asError(e).message}`);
        throw new UnprocessableEntityException(error);
      });

      // For each Safe, upsert the subscription and overwrite the subscribed-to notification types
      await Promise.all(
        upsertSubscriptionsDto.safes.map(async (safe) => {
          try {
            // 1. Upsert subscription
            const [subscription] = await sql<[{ id: number }]>`
              INSERT INTO notification_subscriptions (account_id, chain_id, safe_address, push_notification_device_id)
              VALUES (${account.id}, ${safe.chainId}, ${safe.address}, ${device.id})
              ON CONFLICT (account_id, chain_id, safe_address, push_notification_device_id)
                -- If no value is set ON CONFLICT, an error is thrown meaning nothing is returned
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
      JOIN push_notification_devices pnd ON ns.push_notification_device_id = pnd.id
      JOIN notification_subscription_notification_types nsnt ON ns.id = nsnt.notification_subscription_id
      JOIN notification_types nt ON nsnt.notification_type_id = nt.id
      WHERE ns.account_id = ${account.id}
        AND ns.chain_id = ${args.chainId}
        AND ns.safe_address = ${args.safeAddress}
        AND pnd.device_uuid = ${args.deviceUuid}
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
      SELECT a.address, pnd.cloud_messaging_token
      FROM notification_subscriptions ns
      JOIN accounts a ON ns.account_id = a.id
      JOIN push_notification_devices pnd ON ns.push_notification_device_id = pnd.id
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
    await this.sql.begin(async (sql) => {
      try {
        // 1. Delete the subscription and return device ID
        const [deletedSubscription] = await sql<
          [{ push_notification_device_id: number }]
        >`
          DELETE FROM notification_subscriptions ns
          USING accounts a, push_notification_devices pnd
          WHERE ns.account_id = a.id
            AND ns.push_notification_device_id = pnd.id
            AND a.address = ${args.account}
            AND pnd.device_uuid = ${args.deviceUuid}
            AND ns.chain_id = ${args.chainId}
            AND ns.safe_address = ${args.safeAddress}
          RETURNING ns.push_notification_device_id;
        `;

        // 2. Check if there any remaining subscriptions for device
        const remainingSubscriptions = await sql`
          SELECT 1
          FROM notification_subscriptions
          WHERE push_notification_device_id = ${deletedSubscription.push_notification_device_id}
        `;

        // 3. If no subscriptions, delete orphaned device
        if (remainingSubscriptions.length === 0) {
          // Note: we can't use this.deleteDevice here as we are in a transaction
          await sql`
            DELETE FROM push_notification_devices
            WHERE device_uuid = ${args.deviceUuid}
          `;
        }
      } catch (e) {
        const error = 'Error deleting subscription';
        this.loggingService.info(`${error}: ${asError(e).message}`);
        throw new NotFoundException(error);
      }
    });
  }

  /**
   * Deletes subscriptions for the given device UUID.
   *
   * @param deviceUuid Device UUID
   */
  async deleteDevice(deviceUuid: Uuid): Promise<void> {
    await this.sql`
      DELETE FROM push_notification_devices
      WHERE device_uuid = ${deviceUuid}
    `.catch((e) => {
      const error = 'Error deleting device';
      this.loggingService.info(`${error}: ${asError(e).message}`);
      throw new UnprocessableEntityException(error);
    });
  }
}
