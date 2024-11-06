import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import { UUID } from 'crypto';
import { faker } from '@faker-js/faker';
import postgres from 'postgres';
import { getAddress } from 'viem';

type PushNotificationDevicesRow = {
  id: number;
  device_type: 'ANDROID' | 'IOS' | 'WEB';
  device_uuid: UUID;
  cloud_messaging_token: string;
  created_at: Date;
  updated_at: Date;
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
  signer_address: `0x${string}` | null;
  push_notification_device_id: PushNotificationDevicesRow['id'];
  chain_id: string;
  safe_address: `0x${string}`;
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
          push_notification_devices: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'push_notification_devices'`,
            rows: await sql<
              Array<PushNotificationDevicesRow>
            >`SELECT * FROM push_notification_devices`,
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
      push_notification_devices: {
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
          { column_name: 'signer_address' },
          { column_name: 'push_notification_device_id' },
          { column_name: 'chain_id' },
          { column_name: 'safe_address' },
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

  it('should upsert the updated_at timestamp in push_notification_devices', async () => {
    const deviceType = faker.helpers.enumValue(DeviceType);
    const deviceUuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        // Create device
        return sql<
          [PushNotificationDevicesRow]
        >`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`;
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

    const newDeviceUuid = faker.string.uuid() as UUID;
    // Update device with new device_uuid
    const afterUpdate = await sql<
      [PushNotificationDevicesRow]
    >`UPDATE push_notification_devices SET device_uuid = ${newDeviceUuid} WHERE device_uuid = ${deviceUuid} RETURNING *`;

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

  it('should only allow an ANDROID, IOS, or WEB as device_type in push_notification_devices', async () => {
    const deviceType = faker.lorem.word() as DeviceType;
    const deviceUuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.alphanumeric();
    await migrator.test({
      migration: '00005_notifications',
      after: () => Promise.resolve(),
    });

    // Create device with invalid device_type
    await expect(
      sql`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken})`,
    ).rejects.toThrow(
      'new row for relation "push_notification_devices" violates check constraint "push_notification_devices_device_type_check"',
    );
  });

  it('should not allow a duplicate device_uuid in push_notification_devices', async () => {
    const deviceType = faker.helpers.enumValue(DeviceType);
    const deviceUuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.alphanumeric();
    await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        // Create device
        return sql<
          [PushNotificationDevicesRow]
        >`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`;
      },
    });

    // Create device with duplicate device_uuid
    await expect(
      sql`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken})`,
    ).rejects.toThrow(
      'duplicate key value violates unique constraint "push_notification_devices_device_uuid_key"',
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

  it('should delete the subscription if the device is deleted', async () => {
    const signerAddress = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.enumValue(DeviceType);
    const deviceUuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        // Create device
        const [device] = await sql<
          [PushNotificationDevicesRow]
        >`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`;
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (signer_address, push_notification_device_id, chain_id, safe_address) VALUES (${signerAddress}, ${device.id}, ${chainId}, ${safeAddress}) RETURNING *`;

        return { device, subscription };
      },
    });
    // Delete device
    await sql`DELETE FROM push_notification_devices WHERE id = ${afterMigration.after.device.id}`;

    // Assert that subscription was deleted
    await expect(
      sql`SELECT * FROM notification_subscriptions WHERE id = ${afterMigration.after.subscription.id}`,
    ).resolves.toStrictEqual([]);
  });

  it('should allow nullable signer_address in notification_subscriptions', async () => {
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.enumValue(DeviceType);
    const deviceUuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: (sql: postgres.Sql) => {
        // Create device
        return sql<
          [PushNotificationDevicesRow]
        >`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`;
      },
    });

    // Create subscription
    await expect(
      sql<
        [NotificationSubscriptionsRow]
      >`INSERT INTO notification_subscriptions (push_notification_device_id, chain_id, safe_address) VALUES (${afterMigration.after[0].id}, ${chainId}, ${safeAddress}) RETURNING *`,
    ).resolves.toStrictEqual([
      {
        id: 1,
        signer_address: null,
        push_notification_device_id: afterMigration.after[0].id,
        chain_id: chainId,
        safe_address: safeAddress,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    ]);
  });

  it('should prevent duplicate subscriptions (signer, chain, Safe address and device) in notification_subscriptions', async () => {
    const signerAddress = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.enumValue(DeviceType);
    const deviceUuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        // Create device
        const [device] = await sql<
          [PushNotificationDevicesRow]
        >`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`;
        // Create subscription
        return sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (signer_address, push_notification_device_id, chain_id, safe_address) VALUES (${signerAddress}, ${device.id}, ${chainId}, ${safeAddress}) RETURNING *`;
      },
    });

    // Create duplicate subscription
    await expect(
      sql`INSERT INTO notification_subscriptions (signer_address, push_notification_device_id, chain_id, safe_address) VALUES (${signerAddress}, ${afterMigration.after[0].push_notification_device_id}, ${chainId}, ${safeAddress})`,
    ).rejects.toThrow(
      'duplicate key value violates unique constraint "notification_subscriptions_chain_id_safe_address_push_notif_key"',
    );
  });

  it('should upsert the updated_at timestamp in notification_subscriptions', async () => {
    const signerAddress = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.enumValue(DeviceType);
    const deviceUuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        // Create device
        const [device] = await sql<
          [PushNotificationDevicesRow]
        >`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`;
        // Create subscription
        return sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (signer_address, push_notification_device_id, chain_id, safe_address) VALUES (${signerAddress}, ${device.id}, ${chainId}, ${safeAddress}) RETURNING *`;
      },
    });

    expect(afterMigration.after).toStrictEqual([
      {
        id: 1,
        signer_address: signerAddress,
        push_notification_device_id: 1,
        chain_id: chainId,
        safe_address: safeAddress,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    ]);

    const newSafeAddress = getAddress(faker.finance.ethereumAddress());
    // Update subscription with new safe_address
    const afterUpdate = await sql<
      [PushNotificationDevicesRow]
    >`UPDATE notification_subscriptions SET safe_address = ${newSafeAddress} WHERE id = ${afterMigration.after[0].id} RETURNING *`;

    expect(afterUpdate).toStrictEqual([
      {
        id: afterMigration.after[0].id,
        signer_address: afterMigration.after[0].signer_address,
        push_notification_device_id:
          afterMigration.after[0].push_notification_device_id,
        chain_id: afterMigration.after[0].chain_id,
        safe_address: newSafeAddress,
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
    const signerAddress = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.enumValue(DeviceType);
    const deviceUuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [notificationType]] = await Promise.all([
          // Create device
          sql<
            [PushNotificationDevicesRow]
          >`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
          // Get all notification types
          sql<Array<NotificationTypesRow>>`SELECT * FROM notification_types`,
        ]);
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (signer_address, push_notification_device_id, chain_id, safe_address) VALUES (${signerAddress}, ${device.id}, ${chainId}, ${safeAddress}) RETURNING *`;
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
    const signerAddress = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.enumValue(DeviceType);
    const deviceUuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [notificationType]] = await Promise.all([
          // Create device
          sql<
            [PushNotificationDevicesRow]
          >`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
          // Get all notification types
          sql<Array<NotificationTypesRow>>`SELECT * FROM notification_types`,
        ]);
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (signer_address, push_notification_device_id, chain_id, safe_address) VALUES (${signerAddress}, ${device.id}, ${chainId}, ${safeAddress}) RETURNING *`;
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
    const signerAddress = getAddress(faker.finance.ethereumAddress());
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const deviceType = faker.helpers.enumValue(DeviceType);
    const deviceUuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.alphanumeric();
    const afterMigration = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        const [[device], [notificationType]] = await Promise.all([
          // Create device
          sql<
            [PushNotificationDevicesRow]
          >`INSERT INTO push_notification_devices (device_type, device_uuid, cloud_messaging_token) VALUES (${deviceType}, ${deviceUuid}, ${cloudMessagingToken}) RETURNING *`,
          // Get all notification types
          sql<Array<NotificationTypesRow>>`SELECT * FROM notification_types`,
        ]);
        // Create subscription
        const [subscription] = await sql<
          [NotificationSubscriptionsRow]
        >`INSERT INTO notification_subscriptions (signer_address, push_notification_device_id, chain_id, safe_address) VALUES (${signerAddress}, ${device.id}, ${chainId}, ${safeAddress}) RETURNING *`;
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
