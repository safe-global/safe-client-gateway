import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { DeviceType } from '@/domain/notifications/entities-v2/device-type.entity';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { faker } from '@faker-js/faker';
import postgres from 'postgres';
import { getAddress } from 'viem';

type NotificationDevicesRow = {
  id: number;
  account_id: number;
  device_type: 'ANDROID' | 'IOS' | 'WEB';
  device_uuid: Uuid;
  cloud_messaging_token: string;
  created_at: Date;
  updated_at: Date;
};

type NotificationChannelsRow = {
  id: number;
  name: 'PUSH_NOTIFICATIONS';
};

type NotificationTypesRow = {
  id: number;
  name:
    | 'CONFIRMATION_REQUEST'
    | 'DELETED_MULTISIG_TRANSACTION'
    | 'EXECUTED_MULTISIG_TRANSACTION'
    | 'INCOMING_ETHER'
    | 'INCOMING_TOKEN'
    | 'MESSAGE_CONFIRMATION_REQUEST'
    | 'MODULE_TRANSACTION';
};

type NotificationSubscriptionsRow = {
  id: number;
  account_id: number;
  device_id: NotificationDevicesRow['id'];
  chain_id: string;
  safe_address: `0x${string}`;
  notification_channel_id: NotificationChannelsRow['id'];
  created_at: Date;
  updated_at: Date;
};

type NotificationSubscriptionNotificationTypesRow = {
  id: number;
  notification_subscription_id: NotificationSubscriptionsRow['id'];
  notification_type_id: NotificationTypesRow['id'];
};

describe('Migration 00005_notifications', () => {
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  it('runs successfully', async () => {
    const result = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        return {
          notification_devices: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_devices'`,
            rows: await sql<
              Array<NotificationDevicesRow>
            >`SELECT * FROM notification_devices`,
          },
          notification_channels: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_channels'`,
            rows: await sql<
              Array<NotificationChannelsRow>
            >`SELECT * FROM notification_channels`,
          },
          notification_types: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_types'`,
            rows: await sql<
              Array<NotificationTypesRow>
            >`SELECT * FROM notification_types`,
          },
          notification_subscriptions: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_subscriptions'`,
            rows: await sql<
              Array<NotificationSubscriptionsRow>
            >`SELECT * FROM notification_subscriptions`,
          },
          notification_subscription_notification_types: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_subscription_notification_types'`,
            rows: await sql<
              Array<NotificationSubscriptionNotificationTypesRow>
            >`SELECT * FROM notification_subscription_notification_types`,
          },
        };
      },
    });

    expect(result.after).toStrictEqual({
      notification_devices: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'device_type' },
          { column_name: 'device_uuid' },
          { column_name: 'cloud_messaging_token' },
          { column_name: 'created_at' },
          { column_name: 'updated_at' },
        ]),
        rows: [],
      },
      notification_channels: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'name' },
        ]),
        rows: [
          {
            id: expect.any(Number),
            name: 'PUSH_NOTIFICATIONS',
          },
        ],
      },
      notification_types: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'name' },
        ]),
        rows: [
          {
            id: expect.any(Number),
            name: 'CONFIRMATION_REQUEST',
          },
          {
            id: expect.any(Number),
            name: 'DELETED_MULTISIG_TRANSACTION',
          },
          {
            id: expect.any(Number),
            name: 'EXECUTED_MULTISIG_TRANSACTION',
          },
          {
            id: expect.any(Number),
            name: 'INCOMING_ETHER',
          },
          {
            id: expect.any(Number),
            name: 'INCOMING_TOKEN',
          },
          {
            id: expect.any(Number),
            name: 'MESSAGE_CONFIRMATION_REQUEST',
          },
          {
            id: expect.any(Number),
            name: 'MODULE_TRANSACTION',
          },
        ],
      },
      notification_subscriptions: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'account_id' },
          { column_name: 'device_id' },
          { column_name: 'chain_id' },
          { column_name: 'safe_address' },
          { column_name: 'notification_channel_id' },
          { column_name: 'created_at' },
          { column_name: 'updated_at' },
        ]),
        rows: [],
      },
      notification_subscription_notification_types: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'notification_subscription_id' },
          { column_name: 'notification_type_id' },
        ]),
        rows: [],
      },
    });
  });

  it('should upsert the updated_at timestamp in notification_devices', async () => {
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        // Create device
        return sql<
          [NotificationDevicesRow]
        >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`;
      },
    });

    expect(afterMigration.after).toStrictEqual([
      {
        id: 1,
        device_type: deviceType,
        device_uuid: deviceUuid,
        cloud_messaging_token: cloudMessagingToken,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    ]);

    const newDeviceUuid = faker.string.uuid() as Uuid;
    // Update device with new device_uuid
    const afterUpdate = await sql<
      [NotificationDevicesRow]
    >`UPDATE notification_devices SET device_uuid = ${newDeviceUuid} WHERE device_uuid = ${deviceUuid} RETURNING *`;

    expect(afterUpdate).toStrictEqual([
      {
        id: afterMigration.after[0].id,
        device_type: afterMigration.after[0].device_type,
        device_uuid: newDeviceUuid,
        cloud_messaging_token: afterMigration.after[0].cloud_messaging_token,
        // created_at should have remained the same
        created_at: afterMigration.after[0].created_at,
        updated_at: expect.any(Date),
      },
    ]);
    // updated_at should have updated
    expect(afterMigration.after[0].updated_at).not.toEqual(
      afterUpdate[0].updated_at,
    );
  });

  it('should only allow an ANDROID, IOS, or WEB as device_type in notification_devices', async () => {
    const deviceType = faker.lorem.word() as DeviceType;
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    await migrator.test({
      migration: '00005_notifications',
      after: () => Promise.resolve(),
    });

    // Create device with invalid device_type
    await expect(
      sql`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken})`,
    ).rejects.toThrow(
      'new row for relation "notification_devices" violates check constraint "notification_devices_device_type_check"',
    );
  });

  it('should not allow a duplicate device_uuid in notification_devices', async () => {
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        // Create device
        return sql<
          [NotificationDevicesRow]
        >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`;
      },
    });

    // Create device with duplicate device_uuid
    await expect(
      sql`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken})`,
    ).rejects.toThrow(
      'duplicate key value violates unique constraint "notification_devices_device_uuid_key"',
    );
  });

  it('should delete orphaned devices if there are no subscriptions associated with them', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [channel], [account]] = await Promise.all([
          // Create device
          sql<
            [NotificationDevicesRow]
          >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
          // Get all notification channels
          sql<
            Array<NotificationChannelsRow>
          >`SELECT * FROM notification_channels`,
          // Create account
          sql<
            [
              {
                id: number;
              },
            ]
          >`INSERT INTO accounts (address) VALUES (${address}) RETURNING id`,
        ]);
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress}, ${channel.id}) RETURNING *`;
        return { device, subscription };
      },
    });

    // Delete subscription
    await sql`DELETE FROM notification_subscriptions WHERE id = ${afterMigration.after.subscription.id}`;

    // Assert that device was deleted
    await expect(
      sql`SELECT * FROM notification_devices WHERE id = ${afterMigration.after.device.id}`,
    ).resolves.toStrictEqual([]);
  });

  it('should not delete devices if there are remaining subscriptions associated with them', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const safeAddress1 = getAddress(faker.finance.ethereumAddress());
    const safeAddress2 = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [channel], [account]] = await Promise.all([
          // Create device
          sql<
            [NotificationDevicesRow]
          >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
          // Get all notification channels
          sql<
            Array<NotificationChannelsRow>
          >`SELECT * FROM notification_channels`,
          // Create account
          sql<
            [
              {
                id: number;
              },
            ]
          >`INSERT INTO accounts (address) VALUES (${address}) RETURNING id`,
        ]);
        // Create first subscription
        await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress1}, ${channel.id}) RETURNING *`;
        // Create second subscription
        const [subscription2] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress2}, ${channel.id}) RETURNING *`;
        return { device, subscription2 };
      },
    });

    // Delete subscription
    await sql`DELETE FROM notification_subscriptions WHERE id = ${afterMigration.after.subscription2.id}`;

    // Assert that device was deleted
    await expect(
      sql`SELECT * FROM notification_devices WHERE id = ${afterMigration.after.device.id}`,
    ).resolves.toStrictEqual([
      {
        id: 1,
        device_type: deviceType,
        device_uuid: deviceUuid,
        cloud_messaging_token: cloudMessagingToken,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    ]);
  });

  it("shouldn't allow a duplicate name in notification_channels", async () => {
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: (sql: postgres.Sql) => {
        // Get all notification channels
        return sql<
          Array<NotificationChannelsRow>
        >`SELECT * FROM notification_channels`;
      },
    });

    // Create channel with duplicate name
    await expect(
      sql`INSERT INTO notification_channels (name) VALUES (${afterMigration.after[0].name})`,
    ).rejects.toThrow(
      'duplicate key value violates unique constraint "notification_channels_name_key"',
    );
  });

  it("shouldn't allow a duplicate name in notification_types", async () => {
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: (sql: postgres.Sql) => {
        // Get all notification types
        return sql<
          Array<NotificationTypesRow>
        >`SELECT * FROM notification_types`;
      },
    });

    // Create type with duplicate name
    await expect(
      sql`INSERT INTO notification_types (name) VALUES (${afterMigration.after[0].name})`,
    ).rejects.toThrow(
      'duplicate key value violates unique constraint "notification_types_name_key"',
    );
  });

  it('should delete the subscription if the account is deleted', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [channel], [account]] = await Promise.all([
          // Create device
          sql<
            [NotificationDevicesRow]
          >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
          // Get all notification channels
          sql<
            Array<NotificationChannelsRow>
          >`SELECT * FROM notification_channels`,
          sql<
            [
              {
                id: number;
              },
            ]
          >`INSERT INTO accounts (address) VALUES (${address}) RETURNING id`,
        ]);
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress}, ${channel.id}) RETURNING *`;
        return { account, subscription };
      },
    });
    // Delete account
    await sql`DELETE FROM accounts WHERE id = ${afterMigration.after.account.id}`;

    // Assert that subscription was deleted
    await expect(
      sql`SELECT * FROM notification_subscriptions WHERE id = ${afterMigration.after.subscription.id}`,
    ).resolves.toStrictEqual([]);
  });

  it('should delete the subscription if the device is deleted', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [channel], [account]] = await Promise.all([
          // Create device
          sql<
            [NotificationDevicesRow]
          >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
          // Get all notification channels
          sql<
            Array<NotificationChannelsRow>
          >`SELECT * FROM notification_channels`,
          // Create account
          sql<
            [
              {
                id: number;
              },
            ]
          >`INSERT INTO accounts (address) VALUES (${address}) RETURNING id`,
        ]);
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress}, ${channel.id}) RETURNING *`;

        return { device, subscription };
      },
    });
    // Delete device
    await sql`DELETE FROM notification_devices WHERE id = ${afterMigration.after.device.id}`;

    // Assert that subscription was deleted
    await expect(
      sql`SELECT * FROM notification_subscriptions WHERE id = ${afterMigration.after.subscription.id}`,
    ).resolves.toStrictEqual([]);
  });

  it('should delete the subscription if the channel is deleted', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [channel], [account]] = await Promise.all([
          // Create device
          sql<
            [NotificationDevicesRow]
          >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
          // Get all notification channels
          sql<
            Array<NotificationChannelsRow>
          >`SELECT * FROM notification_channels`,
          // Create account
          sql<
            [
              {
                id: number;
              },
            ]
          >`INSERT INTO accounts (address) VALUES (${address}) RETURNING id`,
        ]);
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress}, ${channel.id}) RETURNING *`;
        return { channel, subscription };
      },
    });
    // Delete channel
    await sql`DELETE FROM notification_channels WHERE id = ${afterMigration.after.channel.id}`;

    // Assert that subscription was deleted
    await expect(
      sql`SELECT * FROM notification_subscriptions WHERE id = ${afterMigration.after.subscription.id}`,
    ).resolves.toStrictEqual([]);
  });

  it('should prevent duplicate subscriptions (account, chain, Safe, device and channel) in notification_subscriptions', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [channel], [account]] = await Promise.all([
          // Create device
          sql<
            [NotificationDevicesRow]
          >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
          // Get all notification channels
          sql<
            Array<NotificationChannelsRow>
          >`SELECT * FROM notification_channels`,
          sql<
            [
              {
                id: number;
              },
            ]
          >`INSERT INTO accounts (address) VALUES (${address}) RETURNING id`,
        ]);
        // Create subscription
        return sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress}, ${channel.id}) RETURNING *`;
      },
    });

    // Create duplicate subscription
    await expect(
      sql`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${afterMigration.after[0].account_id}, ${afterMigration.after[0].device_id}, ${chainId}, ${safeAddress}, ${afterMigration.after[0].notification_channel_id})`,
    ).rejects.toThrow(
      'duplicate key value violates unique constraint "notification_subscriptions_account_id_chain_id_safe_address_key"',
    );
  });

  it('should upsert the updated_at timestamp in notification_subscriptions', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [channel], [account]] = await Promise.all([
          // Create device
          sql<
            [NotificationDevicesRow]
          >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
          // Get all notification channels
          sql<
            Array<NotificationChannelsRow>
          >`SELECT * FROM notification_channels`,
          // Create account
          sql<
            [
              {
                id: number;
              },
            ]
          >`INSERT INTO accounts (address) VALUES (${address}) RETURNING id`,
        ]);
        // Create subscription
        return sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress}, ${channel.id}) RETURNING *`;
      },
    });

    expect(afterMigration.after).toStrictEqual([
      {
        id: 1,
        account_id: 1,
        device_id: 1,
        chain_id: chainId,
        safe_address: safeAddress,
        notification_channel_id: 1,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    ]);

    const newSafeAddress = getAddress(faker.finance.ethereumAddress());
    // Update subscription with new safe_address
    const afterUpdate = await sql<
      [NotificationDevicesRow]
    >`UPDATE notification_subscriptions SET safe_address = ${newSafeAddress} WHERE id = ${afterMigration.after[0].id} RETURNING *`;

    expect(afterUpdate).toStrictEqual([
      {
        id: afterMigration.after[0].id,
        account_id: afterMigration.after[0].account_id,
        device_id: afterMigration.after[0].device_id,
        chain_id: afterMigration.after[0].chain_id,
        safe_address: newSafeAddress,
        notification_channel_id:
          afterMigration.after[0].notification_channel_id,
        // created_at should have remained the same
        created_at: afterMigration.after[0].created_at,
        updated_at: expect.any(Date),
      },
    ]);
    // updated_at should have updated
    expect(afterMigration.after[0].updated_at).not.toEqual(
      afterUpdate[0].updated_at,
    );
  });

  it('should delete the subscribed notification type(s) if the subscription is deleted', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [channel], [notificationType], [account]] =
          await Promise.all([
            // Create device
            sql<
              [NotificationDevicesRow]
            >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
            // Get all notification channels
            sql<
              Array<NotificationChannelsRow>
            >`SELECT * FROM notification_channels`,
            // Get all notification types
            sql<Array<NotificationTypesRow>>`SELECT * FROM notification_types`,
            sql<
              [
                {
                  id: number;
                },
              ]
            >`INSERT INTO accounts (address) VALUES (${address}) RETURNING id`,
          ]);
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress}, ${channel.id}) RETURNING *`;
        // Subscribe to notification type
        const [subscribedNotificationType] = await sql<
          [NotificationSubscriptionNotificationTypesRow]
        >`INSERT INTO notification_subscription_notification_types (notification_subscription_id, notification_type_id) VALUES (${subscription.id}, ${notificationType.id}) RETURNING *`;
        return { subscription, subscribedNotificationType };
      },
    });
    // Delete subscription
    await sql`DELETE FROM notification_subscriptions WHERE id = ${afterMigration.after.subscription.id}`;

    // Assert that the subscribed notification type was deleted
    await expect(
      sql`SELECT * FROM notification_subscription_notification_types WHERE id = ${afterMigration.after.subscribedNotificationType.id}`,
    ).resolves.toStrictEqual([]);
  });

  it('should delete the subscribed notification type if the notification type is deleted', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [channel], [notificationType], [account]] =
          await Promise.all([
            // Create device
            sql<
              [NotificationDevicesRow]
            >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
            // Get all notification channels
            sql<
              Array<NotificationChannelsRow>
            >`SELECT * FROM notification_channels`,
            // Get all notification types
            sql<Array<NotificationTypesRow>>`SELECT * FROM notification_types`,
            // Create account
            sql<
              [
                {
                  id: number;
                },
              ]
            >`INSERT INTO accounts (address) VALUES (${address}) RETURNING id`,
          ]);
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress}, ${channel.id}) RETURNING *`;
        // Subscribe to notification type
        const [subscribedNotificationType] = await sql<
          [NotificationSubscriptionNotificationTypesRow]
        >`INSERT INTO notification_subscription_notification_types (notification_subscription_id, notification_type_id) VALUES (${subscription.id}, ${notificationType.id}) RETURNING *`;
        return { notificationType, subscribedNotificationType };
      },
    });
    // Delete subscription
    await sql`DELETE FROM notification_types WHERE id = ${afterMigration.after.notificationType.id}`;

    // Assert that the subscribed notification type was deleted
    await expect(
      sql`SELECT * FROM notification_subscription_notification_types WHERE id = ${afterMigration.after.subscribedNotificationType.id}`,
    ).resolves.toStrictEqual([]);
  });

  it('should prevent duplicate notification types (subscription, notification type) in notification_subscription_notification_types', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.arrayElement(Object.values(DeviceType));
    const deviceUuid = faker.string.uuid() as Uuid;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [channel], [notificationType], [account]] =
          await Promise.all([
            // Create device
            sql<
              [NotificationDevicesRow]
            >`INSERT INTO notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
            // Get all notification channels
            sql<
              Array<NotificationChannelsRow>
            >`SELECT * FROM notification_channels`,
            // Get all notification types
            sql<Array<NotificationTypesRow>>`SELECT * FROM notification_types`,
            // Create account
            sql<
              [
                {
                  id: number;
                },
              ]
            >`INSERT INTO accounts (address) VALUES (${address}) RETURNING id`,
          ]);
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (account_id, device_id, chain_id, safe_address, notification_channel_id) VALUES (${account.id}, ${device.id}, ${chainId}, ${safeAddress}, ${channel.id}) RETURNING *`;
        // Subscribe to notification type
        return sql<
          [NotificationSubscriptionNotificationTypesRow]
        >`INSERT INTO notification_subscription_notification_types (notification_subscription_id, notification_type_id) VALUES (${subscription.id}, ${notificationType.id}) RETURNING *`;
      },
    });

    // Create duplicate subscription
    await expect(
      sql`INSERT INTO notification_subscription_notification_types (notification_subscription_id, notification_type_id) VALUES (${afterMigration.after[0].notification_subscription_id}, ${afterMigration.after[0].notification_type_id})`,
    ).rejects.toThrow(
      'duplicate key value violates unique constraint "notification_subscription_not_notification_subscription_id__key"',
    );
  });
});
