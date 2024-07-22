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
import { DeviceType } from '@/domain/notifications/entities-v2/device-type.entity';
import { NotificationChannel } from '@/datasources/accounts/notifications/entities/notification-channel.entity';
import { NotificationSubscription } from '@/datasources/accounts/notifications/entities/notification-subscription.entity';
import { NotificationChannelConfig } from '@/datasources/accounts/notifications/entities/notification-channel-config.entity';
import { NotificationType } from '@/datasources/accounts/notifications/entities/notification-type.entity';

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
   * Upserts subscriptions for the given account as per the list of Safes
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
      const channel = await this.getChannel({
        sql,
        name: DomainNotificationChannel.PUSH_NOTIFICATIONS,
      });

      await Promise.all(
        args.safes.map(async (safe) => {
          const subscription = await this.insertSubscription({
            sql,
            accountId: account.id,
            chainId: safe.chainId,
            safeAddress: safe.address,
          });

          await this.insertChannelConfig({
            sql,
            subscriptionId: subscription.id,
            channelId: channel.id,
            cloudMessagingToken: args.cloudMessagingToken,
            deviceType: args.deviceType,
            deviceUuid,
          });

          // Cleanup existing types as incoming safe.notificationTypes
          // are only those to-be-enabled
          await this.deleteSubscriptionTypes({
            sql,
            subscriptionId: subscription.id,
          });

          // Set new notification type preferences
          return await Promise.all(
            safe.notificationTypes.map((notificationType) => {
              return this.insertSubscriptionType({
                sql,
                subscriptionId: subscription.id,
                notificationType,
              });
            }),
          );
        }),
      );
    });

    return { deviceUuid };
  }

  private async getChannel(args: {
    sql: postgres.TransactionSql;
    name: DomainNotificationChannel;
  }): Promise<NotificationChannel> {
    const [channel] = await args.sql<[NotificationChannel]>`
      SELECT id
      FROM notification_channels
      WHERE name = ${args.name}
    `.catch((e) => {
      this.loggingService.info(`Error getting channel: ${asError(e).message}`);
      return [];
    });

    if (!channel) {
      throw new NotFoundException('Error getting channel');
    }

    return channel;
  }

  private async insertSubscription(args: {
    sql: postgres.TransactionSql;
    accountId: number;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<NotificationSubscription> {
    const [subscription] = await args.sql<[NotificationSubscription]>`
      INSERT INTO notification_subscriptions (account_id, chain_id, safe_address)
      VALUES (${args.accountId}, ${args.chainId}, ${args.safeAddress})
      ON CONFLICT (account_id, chain_id, safe_address)
      DO UPDATE SET
        -- Field must be set to return value
        updated_at = NOW()
      RETURNING *`.catch((e) => {
      this.loggingService.info(
        `Error inserting subscription: ${asError(e).message}`,
      );
      return [];
    });

    if (!subscription) {
      throw new UnprocessableEntityException('Error inserting subscription');
    }

    return subscription;
  }

  private async insertChannelConfig(args: {
    sql: postgres.TransactionSql;
    subscriptionId: number;
    channelId: number;
    cloudMessagingToken: string;
    deviceType: DeviceType;
    deviceUuid: Uuid;
  }): Promise<NotificationChannelConfig> {
    const [config] = await args.sql<[NotificationChannelConfig]>`
      INSERT INTO notification_channel_configurations (
        notification_subscription_id,
        notification_channel_id,
        cloud_messaging_token,
        device_type,
        device_uuid
      ) VALUES (
        ${args.subscriptionId},
        ${args.channelId},
        ${args.cloudMessagingToken},
        ${args.deviceType},
        ${args.deviceUuid}
      )
      ON CONFLICT (notification_subscription_id, notification_channel_id, device_uuid)
      DO UPDATE SET
        cloud_messaging_token = EXCLUDED.cloud_messaging_token
      RETURNING *
      `.catch((e) => {
      this.loggingService.info(
        `Error inserting channel configuration: ${asError(e).message}`,
      );
      return [];
    });

    console.log({ config });
    if (!config) {
      throw new UnprocessableEntityException(
        'Error inserting channel configuration',
      );
    }

    return config;
  }

  private async deleteSubscriptionTypes(args: {
    sql: postgres.TransactionSql;
    subscriptionId: number;
  }): Promise<void> {
    await args.sql`
      DELETE FROM notification_subscription_notification_types
        WHERE subscription_id = ${args.subscriptionId}
    `.catch((e) => {
      this.loggingService.info(
        `Error deleting subscription notification types: ${asError(e).message}`,
      );
      throw new UnprocessableEntityException(
        'Error deleting subscription notification types',
      );
    });
  }

  private async insertSubscriptionType(args: {
    sql: postgres.TransactionSql;
    subscriptionId: number;
    // TODO: Accept array
    notificationType: DomainNotificationType;
  }): Promise<void> {
    await args.sql`INSERT INTO notification_subscription_notification_types (subscription_id, notification_type_id)
      VALUES (${args.subscriptionId}, (SELECT id FROM notification_types WHERE name = ${args.notificationType}))`.catch(
      (e) => {
        this.loggingService.info(
          `Error inserting subscription notification type: ${asError(e).message}`,
        );
        throw new UnprocessableEntityException(
          'Error inserting subscription notification type',
        );
      },
    );
  }

  /**
   * Gets notification preferences for given account for the device/Safe.
   *
   * @param args.account Account address
   * @param args.deviceUuid Device UUID
   * @param args.chainId Chain ID
   * @param args.safeAddress Safe address
   *
   * @returns Notification preferences for the device/Safe
   */
  async getSafeSubscription(args: {
    account: `0x${string}`;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Record<DomainNotificationType, boolean>> {
    const account = await this.accountsDatasource.getAccount(args.account);

    return this.sql.begin(async (sql) => {
      const subscription = await this.getAccountSubscription({
        sql,
        accountId: account.id,
        deviceUuid: args.deviceUuid,
        chainId: args.chainId,
        safeAddress: args.safeAddress,
      });

      const notificationTypes = await this.getNotificationTypes({
        sql,
        subscriptionId: subscription.id,
      });

      return this.mapNotificationTypes(notificationTypes);
    });
  }

  private async getAccountSubscription(args: {
    sql: postgres.TransactionSql;
    accountId: number;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<NotificationSubscription> {
    const [subscription] = await args.sql<[NotificationSubscription]>`
      SELECT * 
      FROM notification_subscriptions ns
      JOIN notification_channel_configurations ncc
      ON ns.id = ncc.notification_subscription_id
      WHERE ns.account_id = ${args.accountId} 
      AND ns.chain_id = ${args.chainId} 
      AND ns.safe_address = ${args.safeAddress} 
      AND ncc.device_uuid = ${args.deviceUuid};
    `.catch((e) => {
      this.loggingService.info(
        `Error getting account subscription: ${asError(e).message}`,
      );
      return [];
    });

    if (!subscription) {
      throw new NotFoundException('Error getting account subscription');
    }

    return subscription;
  }

  private async getNotificationTypes(args: {
    sql: postgres.TransactionSql;
    subscriptionId: number;
  }): Promise<Array<NotificationType>> {
    const types = await args.sql<Array<NotificationType>>`
        SELECT nt.name 
        FROM notification_subscription_notification_types nsnt
        JOIN notification_types nt ON nsnt.notification_type_id = nt.id
        WHERE nsnt.subscription_id = ${args.subscriptionId};
      `.catch((e) => {
      this.loggingService.info(
        `Error getting notification types: ${asError(e).message}`,
      );
      return [];
    });

    if (types.length === 0) {
      throw new NotFoundException('Error getting notification types');
    }

    return types;
  }

  private mapNotificationTypes(
    notificationTypes: Array<NotificationType>,
  ): Record<DomainNotificationType, boolean> {
    return Object.values(DomainNotificationType).reduce<
      Record<DomainNotificationType, boolean>
    >(
      (acc, type) => {
        acc[type] = notificationTypes.some((row) => row.name === type);
        return acc;
      },
      {} as Record<DomainNotificationType, boolean>,
    );
  }

  /**
   * Gets cloud messaging tokens for the given Safe.
   *
   * @param args.chainId Chain ID
   * @param args.safeAddress Safe address
   *
   * @returns List of cloud messaging tokens for the Safe
   */
  async getCloudMessagingTokensBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationChannelConfig['cloud_messaging_token']>> {
    return this.sql.begin(async (sql) => {
      const subscriptions = await this.getSafeSubscriptions({
        sql,
        chainId: args.chainId,
        safeAddress: args.safeAddress,
      });
      const subscriptionIds = subscriptions.map((row) => row.id);

      const configurations = await this.getChannelConfigs({
        sql,
        subscriptionIds,
      });
      return configurations.map((row) => row.cloud_messaging_token);
    });
  }

  private async getSafeSubscriptions(args: {
    sql: postgres.TransactionSql;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationSubscription>> {
    const subscriptions = await args.sql<Array<NotificationSubscription>>`
        SELECT * 
        FROM notification_subscriptions 
        WHERE chain_id = ${args.chainId} AND safe_address = ${args.safeAddress};
      `.catch((e) => {
      this.loggingService.info(
        `Error getting Safe subscriptions: ${asError(e).message}`,
      );
      return [];
    });

    if (subscriptions.length === 0) {
      throw new NotFoundException('Error getting Safe subscriptions');
    }

    return subscriptions;
  }

  private async getChannelConfigs(args: {
    sql: postgres.TransactionSql;
    subscriptionIds: Array<number>;
  }): Promise<Array<NotificationChannelConfig>> {
    const configs = await args.sql<Array<NotificationChannelConfig>>`
      SELECT cloud_messaging_token 
      FROM notification_channel_configurations 
      WHERE notification_subscription_id = ANY(${args.subscriptionIds});
    `.catch((e) => {
      this.loggingService.info(
        `Error getting channel configurations: ${asError(e).message}`,
      );
      return [];
    });

    if (configs.length === 0) {
      throw new NotFoundException('Error getting channel configurations');
    }

    return configs;
  }

  /**
   * Deletes the subscription for the given account/Safe.
   *
   * @param args.account Account address
   * @param args.chainId Chain ID
   * @param args.safeAddress Safe address
   */
  async deleteSubscription(args: {
    account: `0x${string}`;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    await this.sql.begin(async (sql) => {
      const subscription = await this.getAccountSubscriptions({
        sql,
        ...args,
      });

      return this.deleteSubscriptionById({
        sql,
        subscriptionId: subscription.id,
      });
    });
  }

  private async getAccountSubscriptions(args: {
    sql: postgres.TransactionSql;
    account: `0x${string}`;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<NotificationSubscription> {
    const [subscription] = await args.sql<[NotificationSubscription]>`
        SELECT notification_subscriptions.id 
        FROM notification_subscriptions
        JOIN accounts ON notification_subscriptions.account_id = accounts.id
        WHERE accounts.address = ${args.account} AND notification_subscriptions.safe_address = ${args.safeAddress} AND notification_subscriptions.chain_id = ${args.chainId}
      `.catch((e) => {
      this.loggingService.info(
        `Error getting subscription for account/Safe: ${asError(e).message}`,
      );
      return [];
    });

    if (!subscription) {
      throw new NotFoundException(
        'Error getting subscription for account/Safe',
      );
    }

    return subscription;
  }

  private async deleteSubscriptionById(args: {
    sql: postgres.TransactionSql;
    subscriptionId: number;
  }): Promise<void> {
    await args.sql`
      DELETE FROM notification_subscriptions
      WHERE id = ${args.subscriptionId}
    `.catch((e) => {
      this.loggingService.info(
        `Error deleting subscription: ${asError(e).message}`,
      );
      throw new UnprocessableEntityException('Error deleting subscription');
    });
  }

  /**
   * Deletes the device and all its subscriptions.
   * @param deviceUuid Device UUID
   */
  async deleteDevice(deviceUuid: Uuid): Promise<void> {
    await this.sql.begin(async (sql) => {
      const configs = await this.getChannelConfigsByDevice({
        sql,
        deviceUuid,
      });
      const subscriptionIds = configs.map(
        (row) => row.notification_subscription_id,
      );

      await this.deleteSubscriptions({
        sql,
        subscriptionIds,
      });
    });
  }

  private async getChannelConfigsByDevice(args: {
    sql: postgres.TransactionSql;
    deviceUuid: Uuid;
  }): Promise<Array<NotificationChannelConfig>> {
    const configs = await args.sql<Array<NotificationChannelConfig>>`
      SELECT DISTINCT *
      FROM notification_channel_configurations
      WHERE device_uuid = ${args.deviceUuid}
    `.catch((e) => {
      this.loggingService.info(
        `Error getting channel configurations: ${asError(e).message}`,
      );
      return [];
    });

    if (configs.length === 0) {
      throw new NotFoundException('Error getting channel configurations');
    }

    return configs;
  }

  private async deleteSubscriptions(args: {
    sql: postgres.TransactionSql;
    subscriptionIds: Array<number>;
  }): Promise<void> {
    await args.sql`
      DELETE FROM notification_subscriptions
      WHERE id = ANY(${args.subscriptionIds})
    `.catch((e) => {
      this.loggingService.info(
        `Error deleting subscriptions: ${asError(e).message}`,
      );
      throw new UnprocessableEntityException('Error deleting subscriptions');
    });
  }
}
