import { NotificationType as DomainNotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import { UUID } from 'crypto';
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
import { UpsertSubscriptionsDto } from '@/routes/notifications/v1/entities/upsert-subscriptions.dto.entity';

@Injectable()
export class NotificationsDatasource implements INotificationsDatasource {
  constructor(
    @Inject('DB_INSTANCE')
    private readonly sql: postgres.Sql,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Upserts subscriptions for the given signer/device as per the list of Safes
   * and notification types provided.
   *
   * @param args.signerAddress Signer address (optional)
   * @param args.upsertSubscriptionsDto {@link UpsertSubscriptionsDto} DTO
   *
   * @returns Device UUID
   */
  async upsertSubscriptions(args: {
    signerAddress?: `0x${string}`;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{ deviceUuid: UUID }> {
    const deviceUuid =
      args.upsertSubscriptionsDto.deviceUuid ?? crypto.randomUUID();

    await this.sql.begin(async (sql) => {
      // Insert (or update the type/cloud messaging token of) a device
      const [device] = await sql<[{ id: number }]>`
        INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token)
        VALUES (${args.upsertSubscriptionsDto.deviceType}, ${deviceUuid}, ${args.upsertSubscriptionsDto.cloudMessagingToken})
        ON CONFLICT (device_uuid)
        DO UPDATE SET
          cloud_messaging_token = EXCLUDED.cloud_messaging_token,
          device_type = EXCLUDED.device_type,
          -- If updated_at is not set ON CONFLICT, an error is thrown meaning nothing is returned
          updated_at = NOW()
        RETURNING id
      `.catch((e) => {
        const error = 'Error getting device';
        this.loggingService.warn(`${error}: ${asError(e).message}`);
        throw new UnprocessableEntityException(error);
      });

      // For each Safe, upsert the subscription and overwrite the subscribed-to notification types
      await Promise.all(
        args.upsertSubscriptionsDto.safes.map(async (safe) => {
          try {
            // 1. Delete previous subscriptions (and by cascade, notification types)
            //    to avoid duplicates, and clearing "unknown" subscriptions
            await sql`
              DELETE FROM notification_subscriptions
              WHERE chain_id = ${safe.chainId}
              AND safe_address = ${safe.address}
              AND (
                signer_address = ${args.signerAddress ?? null}
                OR (
                  signer_address IS NULL
                )
              )
              AND push_notification_device_id = ${device.id}
            `;

            // 2. Upsert subscription
            const [subscription] = await sql<[{ id: number }]>`
              INSERT INTO notification_subscriptions (chain_id, safe_address, signer_address, push_notification_device_id)
              VALUES (${safe.chainId}, ${safe.address}, ${args.signerAddress ?? null}, ${device.id})
              ON CONFLICT (chain_id, safe_address, signer_address, push_notification_device_id)
                -- If no value is set ON CONFLICT, an error is thrown meaning nothing is returned
                DO UPDATE SET updated_at = NOW()
              RETURNING id
            `;

            // 3. Insert subscribed-to notification types
            await sql`
              INSERT INTO notification_subscription_notification_types (notification_subscription_id, notification_type_id)
              SELECT ${subscription.id}, id
              FROM notification_types
              WHERE name = ANY(${safe.notificationTypes})
            `;
          } catch (e) {
            const error = 'Error upserting subscription';
            this.loggingService.warn(`${error}: ${asError(e).message}`);
            throw new NotFoundException();
          }
        }),
      );
    });

    return { deviceUuid };
  }

  /**
   * Gets notification preferences for given signer/device for the given Safe.
   *
   * @param args.deviceUuid Device UUID
   * @param args.chainId Chain ID
   * @param args.safeAddress Safe address
   * @param args.signerAddress Signer address
   *
   * @returns List of {@link DomainNotificationType} notifications subscribed to
   */
  async getSafeSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
    signerAddress: `0x${string}`;
  }): Promise<Array<DomainNotificationType>> {
    const notificationTypes = await this.sql<
      Array<{ name: DomainNotificationType }>
    >`
      SELECT nt.name 
      FROM notification_subscriptions ns
      JOIN push_notification_devices pnd ON ns.push_notification_device_id = pnd.id
      JOIN notification_subscription_notification_types nsnt ON ns.id = nsnt.notification_subscription_id
      JOIN notification_types nt ON nsnt.notification_type_id = nt.id
      WHERE ns.chain_id = ${args.chainId}
        AND ns.safe_address = ${args.safeAddress}
        AND ns.signer_address = ${args.signerAddress}
        AND pnd.device_uuid = ${args.deviceUuid}
    `.catch((e) => {
      const error = 'Error getting subscription or notification types';
      this.loggingService.warn(`${error}: ${asError(e).message}`);
      throw new NotFoundException(error);
    });

    return notificationTypes.map((notificationType) => notificationType.name);
  }

  /**
   * Gets subscribers and their device UUID/cloud messaging tokens for the given Safe.
   *
   * @param args.chainId Chain ID
   * @param args.safeAddress Safe address
   *
   * @returns List of subscribers/tokens for given Safe
   */
  async getSubscribersBySafe(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<
    Array<{
      subscriber: `0x${string}` | null;
      deviceUuid: UUID;
      cloudMessagingToken: string;
    }>
  > {
    const subscribers = await this.sql<
      Array<{
        signer_address: `0x${string}` | null;
        cloud_messaging_token: string;
        device_uuid: UUID;
      }>
    >`
      SELECT 
        pd.cloud_messaging_token,
        ns.signer_address,
        pd.device_uuid
      FROM 
        push_notification_devices pd
      JOIN 
        notification_subscriptions ns ON pd.id = ns.push_notification_device_id
      WHERE 
        ns.chain_id = ${args.chainId}
        AND ns.safe_address = ${args.safeAddress};
    `.catch((e) => {
      const error = 'Error getting subscribers with tokens';
      this.loggingService.warn(`${error}: ${asError(e).message}`);
      throw new NotFoundException(error);
    });

    return subscribers.map((subscriber) => {
      return {
        subscriber: subscriber.signer_address,
        deviceUuid: subscriber.device_uuid,
        cloudMessagingToken: subscriber.cloud_messaging_token,
      };
    });
  }

  /**
   * Deletes the Safe subscription for the given signer/device.
   *
   * @param args.deviceUuid Device UUID
   * @param args.chainId Chain ID
   * @param args.safeAddress Safe address
   * @param args.signerAddress Signer address
   */
  async deleteSubscription(args: {
    deviceUuid: UUID;
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
          USING push_notification_devices pnd
          WHERE ns.push_notification_device_id = pnd.id
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
        this.loggingService.warn(`${error}: ${asError(e).message}`);
        throw new NotFoundException(error);
      }
    });
  }

  /**
   * Deletes subscriptions for the given device UUID.
   *
   * @param deviceUuid Device UUID
   */
  async deleteDevice(deviceUuid: UUID): Promise<void> {
    await this.sql`
      DELETE FROM push_notification_devices
      WHERE device_uuid = ${deviceUuid}
    `.catch((e) => {
      const error = 'Error deleting device';
      this.loggingService.warn(`${error}: ${asError(e).message}`);
      throw new UnprocessableEntityException(error);
    });
  }
}
