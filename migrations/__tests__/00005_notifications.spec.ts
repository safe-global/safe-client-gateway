import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { faker } from '@faker-js/faker';
import postgres from 'postgres';

type NotificationTypesRow = {
  id: number;
  name: string;
};

type NotificationSubscriptionsRow = {
  id: number;
  account_id: number;
  chain_id: string;
  safe_address: `0x${string}`;
  created_at: Date;
  updated_at: Date;
};

type NotificationSubscriptionNotificationTypesRow = {
  id: number;
  subscription_id: number;
  notification_type_id: number;
};

type NotificationChannelsRow = {
  id: number;
  name: string;
};

type NotificationChannelConfigurationsRow = {
  id: number;
  notification_subscription_id: number;
  notification_channel_id: number;
  device_uuid: `${string}-${string}-${string}-${string}-${string}`;
  cloud_messaging_token: string;
  created_at: Date;
  updated_at: Date;
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
              Array<NotificationChannelsRow>
            >`SELECT * FROM notification_subscription_notification_types`,
          },
          notification_channels: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_channels'`,
            rows: await sql<
              Array<NotificationChannelsRow>
            >`SELECT * FROM notification_channels`,
          },
          notification_channel_configurations: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_channel_configurations'`,
            rows: await sql<
              Array<NotificationChannelConfigurationsRow>
            >`SELECT * FROM notification_channel_configurations`,
          },
        };
      },
    });

    expect(result.after).toStrictEqual({
      notification_subscriptions: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'account_id' },
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
          { column_name: 'subscription_id' },
          { column_name: 'notification_type_id' },
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
      notification_channel_configurations: {
        columns: expect.arrayContaining([
          { column_name: 'updated_at' },
          { column_name: 'created_at' },
          { column_name: 'notification_subscription_id' },
          { column_name: 'notification_channel_id' },
          { column_name: 'id' },
          { column_name: 'device_uuid' },
          { column_name: 'cloud_messaging_token' },
        ]),
        rows: [],
      },
    });
  });

  it('should upsert the row timestamps of notification_subscriptions on insertion/update', async () => {
    const afterInsert = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                VALUES ('0x69');`;
          // Add notification subscription to account
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, safe_address)
                                VALUES (1, 1, '0x420')`;
        });

        return {
          columns:
            await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_subscriptions'`,
          rows: await sql<
            Array<NotificationSubscriptionsRow>
          >`SELECT * FROM notification_subscriptions`,
        };
      },
    });

    expect(afterInsert.after).toStrictEqual({
      columns: expect.arrayContaining([
        { column_name: 'id' },
        { column_name: 'account_id' },
        { column_name: 'chain_id' },
        { column_name: 'safe_address' },
        { column_name: 'created_at' },
        { column_name: 'updated_at' },
      ]),
      rows: [
        {
          id: 1,
          chain_id: '1',
          account_id: 1,
          safe_address: '0x420',
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ],
    });

    const afterUpdate = await sql<
      Array<NotificationSubscriptionsRow>
    >`UPDATE notification_subscriptions
                SET safe_address = '0x69'
                WHERE id = 1 RETURNING *`;

    expect(afterUpdate).toStrictEqual([
      {
        id: 1,
        chain_id: '1',
        account_id: 1,
        safe_address: '0x69',
        // created_at should have remained the same
        created_at: afterInsert.after.rows[0].created_at,
        updated_at: expect.any(Date),
      },
    ]);
    // updated_at should have updated
    expect(afterInsert.after.rows[0].updated_at).not.toEqual(
      afterUpdate[0].updated_at,
    );
  });

  it('should upsert the row timestamps of notification_channel_configurations on insertion/update', async () => {
    const afterInsert = await migrator.test({
      migration: '00005_notifications',
      after: async (sql: postgres.Sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                VALUES ('0x69');`;
          // Add notification subscription to account
          const [subscription] = await transaction<
            [Pick<NotificationSubscriptionsRow, 'id'>]
          >`INSERT INTO notification_subscriptions (account_id, chain_id, safe_address)
                                VALUES (1, 1, '0x420') RETURNING id`;
          // Add notification preference
          await transaction`INSERT INTO notification_subscription_notification_types (subscription_id, notification_type_id)
                                VALUES(${subscription.id}, 1)`;

          // Enable notification channel
          await transaction`INSERT INTO notification_channel_configurations (notification_subscription_id, notification_channel_id, cloud_messaging_token, device_uuid, device_type)
                                VALUES (1, 1, '69420', ${crypto.randomUUID()}, 'WEB')`;
        });

        return {
          columns:
            await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_channel_configurations'`,
          rows: await sql<
            Array<NotificationChannelConfigurationsRow>
          >`SELECT * FROM notification_channel_configurations`,
        };
      },
    });

    expect(afterInsert.after).toStrictEqual({
      columns: expect.arrayContaining([
        { column_name: 'id' },
        { column_name: 'notification_subscription_id' },
        { column_name: 'notification_channel_id' },
        { column_name: 'device_uuid' },
        { column_name: 'device_type' },
        { column_name: 'cloud_messaging_token' },
        { column_name: 'created_at' },
        { column_name: 'updated_at' },
      ]),
      rows: [
        {
          id: 1,
          notification_subscription_id: 1,
          notification_channel_id: 1,
          device_uuid: expect.any(String),
          device_type: 'WEB',
          cloud_messaging_token: '69420',
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ],
    });

    const afterUpdate = await sql<
      Array<NotificationChannelConfigurationsRow>
    >`UPDATE notification_channel_configurations
                SET cloud_messaging_token = '1337'
                WHERE id = 1 RETURNING *`;

    expect(afterUpdate).toStrictEqual([
      {
        id: 1,
        notification_subscription_id: 1,
        notification_channel_id: 1,
        device_uuid: expect.any(String),
        device_type: 'WEB',
        cloud_messaging_token: '1337',
        // created_at should have remained the same
        created_at: afterInsert.after.rows[0].created_at,
        updated_at: expect.any(Date),
      },
    ]);
    // updated_at should have updated
    expect(afterInsert.after.rows[0].updated_at).not.toEqual(
      afterUpdate[0].updated_at,
    );
  });

  it('should prevent duplicate subscriptions in notification_subscriptions', async () => {
    await migrator.test({
      migration: '00005_notifications',
      after: async (sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                    VALUES ('0x69');`;
          // Add notification subscription to account
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, safe_address)
                                    VALUES (1, 1,'0x420')`;
        });
      },
    });

    // Try to add the same subscription again
    await expect(sql<
      Array<NotificationSubscriptionsRow>
    >`INSERT INTO notification_subscriptions (account_id, chain_id, safe_address)
                                    VALUES (1, 1, '0x420')`).rejects.toThrow(
      'duplicate key value violates unique constraint "notification_subscriptions_account_id_chain_id_safe_address_key"',
    );
  });

  it('should delete the subscription and configuration if the account is deleted', async () => {
    const result = await migrator.test({
      migration: '00005_notifications',
      after: async (sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                        VALUES ('0x69');`;

          // Add subscriptions to chains 1, 2, 3
          const chainIds = ['1', '2', '3'];

          await Promise.all(
            chainIds.map((chainId) => {
              return transaction`INSERT INTO notification_subscriptions (account_id, chain_id, safe_address)
                                        VALUES (1, ${chainId}, '0x420')`;
            }),
          );
        });

        // Delete account
        await sql`DELETE FROM accounts WHERE id = 1`;

        return {
          notification_types: await sql<
            Array<NotificationTypesRow>
          >`SELECT * FROM notification_types`,
          notification_subscriptions: await sql<
            Array<NotificationSubscriptionsRow>
          >`SELECT * FROM notification_subscriptions`,
          notification_subscription_notification_types: await sql<
            Array<NotificationSubscriptionNotificationTypesRow>
          >`SELECT * FROM notification_subscription_notification_types`,
          notification_channels: await sql<
            Array<NotificationChannelsRow>
          >`SELECT * FROM notification_channels`,
          notification_channel_configurations: await sql<
            Array<NotificationChannelConfigurationsRow>
          >`SELECT * FROM notification_channel_configurations`,
        };
      },
    });

    expect(result.after).toStrictEqual({
      notification_types: [
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
      // No subscriptions should exist
      notification_subscriptions: [],
      notification_subscription_notification_types: [],
      notification_channels: [
        {
          id: 1,
          name: 'PUSH_NOTIFICATIONS',
        },
      ],
      notification_channel_configurations: [],
    });
  });

  it('should delete the notification_channel_configuration if the notification_channel is deleted', async () => {
    const result = await migrator.test({
      migration: '00005_notifications',
      after: async (sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                        VALUES ('0x69');`;

          // Add subscriptions to chains 1, 2, 3
          const chainIds = ['1', '2', '3'];

          await Promise.all(
            chainIds.map((chainId) => {
              return transaction`INSERT INTO notification_subscriptions (account_id, chain_id, safe_address)
                                        VALUES (1, ${chainId}, '0x420')`;
            }),
          );

          // Enable notification channel
          await transaction`INSERT INTO notification_channel_configurations (notification_subscription_id, notification_channel_id, cloud_messaging_token, device_uuid, device_type)
                                        VALUES (1, 1, '69420', ${crypto.randomUUID()}, 'WEB')`;
        });

        const [channel] = await sql<
          [Pick<NotificationChannelsRow, 'id'>]
        >`SELECT id FROM notification_channels WHERE name = 'PUSH_NOTIFICATIONS'`;
        // Delete PUSH_NOTIFICATIONS notification channel
        await sql`DELETE FROM notification_channels WHERE id = ${channel.id}`;

        return {
          notification_types: await sql<
            Array<NotificationTypesRow>
          >`SELECT * FROM notification_types`,
          notification_subscriptions: await sql<
            Array<NotificationSubscriptionsRow>
          >`SELECT * FROM notification_subscriptions`,
          notification_subscription_notification_types: await sql<
            Array<NotificationSubscriptionNotificationTypesRow>
          >`SELECT * FROM notification_subscription_notification_types`,
          notification_channels: await sql<
            Array<NotificationChannelsRow>
          >`SELECT * FROM notification_channels`,
          notification_channel_configurations: await sql<
            Array<NotificationChannelConfigurationsRow>
          >`SELECT * FROM notification_channel_configurations`,
        };
      },
    });

    expect(result.after).toStrictEqual({
      notification_types: [
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
      notification_subscriptions: [
        {
          id: 1,
          chain_id: '1',
          account_id: 1,
          safe_address: '0x420',
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: 2,
          chain_id: '2',
          account_id: 1,
          safe_address: '0x420',
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: 3,
          chain_id: '3',
          account_id: 1,
          safe_address: '0x420',
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ],
      notification_subscription_notification_types: [],
      notification_channels: [],
      // No configurations should exist
      notification_channel_configurations: [],
    });
  });
});
