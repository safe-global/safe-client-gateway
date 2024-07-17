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
  notification_type_id: number;
  chain_id: number;
  safe_address: string;
  created_at: Date;
  updated_at: Date;
};

type NotificationMediumsRow = {
  id: number;
  name: string;
};

type NotificationMediumConfigurationsRow = {
  id: number;
  notification_subscription_id: number;
  notification_medium_id: number;
  device_uuid: `${string}-${string}-${string}-${string}-${string}`;
  cloud_messaging_token: string;
  created_at: Date;
  updated_at: Date;
};

describe('Migration 00004_notifications', () => {
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
      migration: '00004_notifications',
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
          notification_mediums: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_mediums'`,
            rows: await sql<
              Array<NotificationMediumsRow>
            >`SELECT * FROM notification_mediums`,
          },
          notification_medium_configurations: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_medium_configurations'`,
            rows: await sql<
              Array<NotificationMediumConfigurationsRow>
            >`SELECT * FROM notification_medium_configurations`,
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
          { column_name: 'notification_type_id' },
          { column_name: 'safe_address' },
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
            name: 'MESSAGE_CREATED',
          },
          {
            id: expect.any(Number),
            name: 'MODULE_TRANSACTION',
          },
          {
            id: expect.any(Number),
            name: 'NEW_CONFIRMATION',
          },
          {
            id: expect.any(Number),
            name: 'MESSAGE_CONFIRMATION',
          },
          {
            id: expect.any(Number),
            name: 'OUTGOING_ETHER',
          },
          {
            id: expect.any(Number),
            name: 'OUTGOING_TOKEN',
          },
          {
            id: expect.any(Number),
            name: 'PENDING_MULTISIG_TRANSACTION',
          },
          {
            id: expect.any(Number),
            name: 'SAFE_CREATED',
          },
        ],
      },
      notification_mediums: {
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
      notification_medium_configurations: {
        columns: expect.arrayContaining([
          { column_name: 'updated_at' },
          { column_name: 'created_at' },
          { column_name: 'notification_subscription_id' },
          { column_name: 'notification_medium_id' },
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
      migration: '00004_notifications',
      after: async (sql: postgres.Sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                VALUES ('0x69');`;
          // Add notification subscription to account
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                VALUES (1, 1, 1, '0x420')`;
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
        { column_name: 'notification_type_id' },
        { column_name: 'safe_address' },
        { column_name: 'created_at' },
        { column_name: 'updated_at' },
      ]),
      rows: [
        {
          id: 1,
          chain_id: 1,
          account_id: 1,
          notification_type_id: 1,
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
        chain_id: 1,
        account_id: 1,
        notification_type_id: 1,
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

  it('should upsert the row timestamps of notification_medium_configurations on insertion/update', async () => {
    const afterInsert = await migrator.test({
      migration: '00004_notifications',
      after: async (sql: postgres.Sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                VALUES ('0x69');`;
          // Add notification subscription to account
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                VALUES (1, 1, 1, '0x420')`;
          // Enable notification medium
          await transaction`INSERT INTO notification_medium_configurations (notification_subscription_id, notification_medium_id, cloud_messaging_token)
                                VALUES (1, 1, '69420')`;
        });

        return {
          columns:
            await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notification_medium_configurations'`,
          rows: await sql<
            Array<NotificationMediumConfigurationsRow>
          >`SELECT * FROM notification_medium_configurations`,
        };
      },
    });

    expect(afterInsert.after).toStrictEqual({
      columns: expect.arrayContaining([
        { column_name: 'id' },
        { column_name: 'notification_subscription_id' },
        { column_name: 'notification_medium_id' },
        { column_name: 'device_uuid' },
        { column_name: 'cloud_messaging_token' },
        { column_name: 'created_at' },
        { column_name: 'updated_at' },
      ]),
      rows: [
        {
          id: 1,
          notification_subscription_id: 1,
          notification_medium_id: 1,
          device_uuid: expect.any(String),
          cloud_messaging_token: '69420',
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ],
    });

    const afterUpdate = await sql<
      Array<NotificationMediumConfigurationsRow>
    >`UPDATE notification_medium_configurations
                SET cloud_messaging_token = '1337'
                WHERE id = 1 RETURNING *`;

    expect(afterUpdate).toStrictEqual([
      {
        id: 1,
        notification_subscription_id: 1,
        notification_medium_id: 1,
        device_uuid: expect.any(String),
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
      migration: '00004_notifications',
      after: async (sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                    VALUES ('0x69');`;
          // Add notification subscription to account
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                    VALUES (1, 1, 1, '0x420')`;
        });
      },
    });

    // Try to add the same subscription again
    await expect(sql<
      Array<NotificationSubscriptionsRow>
    >`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                    VALUES (1, 1, 1, '0x420')`).rejects.toThrow(
      'duplicate key value violates unique constraint "notification_subscriptions_account_id_chain_id_safe_address_key"',
    );
  });

  it('should delete the subscription and configuration if the account is deleted', async () => {
    const result = await migrator.test({
      migration: '00004_notifications',
      after: async (sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                        VALUES ('0x69');`;
          // Add notification subscription to account on chains 1, 2, 3
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                        VALUES (1, 1, 1, '0x420')`;
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                        VALUES (1, 2, 1, '0x420')`;
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                        VALUES (1, 3, 1, '0x420')`;
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
          notification_mediums: await sql<
            Array<NotificationMediumsRow>
          >`SELECT * FROM notification_mediums`,
          notification_medium_configurations: await sql<
            Array<NotificationMediumConfigurationsRow>
          >`SELECT * FROM notification_medium_configurations`,
        };
      },
    });

    expect(result.after).toStrictEqual({
      notification_types: [
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
          name: 'MESSAGE_CREATED',
        },
        {
          id: expect.any(Number),
          name: 'MODULE_TRANSACTION',
        },
        {
          id: expect.any(Number),
          name: 'NEW_CONFIRMATION',
        },
        {
          id: expect.any(Number),
          name: 'MESSAGE_CONFIRMATION',
        },
        {
          id: expect.any(Number),
          name: 'OUTGOING_ETHER',
        },
        {
          id: expect.any(Number),
          name: 'OUTGOING_TOKEN',
        },
        {
          id: expect.any(Number),
          name: 'PENDING_MULTISIG_TRANSACTION',
        },
        {
          id: expect.any(Number),
          name: 'SAFE_CREATED',
        },
      ],
      // No subscriptions should exist
      notification_subscriptions: [],
      notification_mediums: [
        {
          id: 1,
          name: 'PUSH_NOTIFICATIONS',
        },
      ],
      notification_medium_configurations: [],
    });
  });

  it('should delete the subscription if the notification_type is deleted', async () => {
    const result = await migrator.test({
      migration: '00004_notifications',
      after: async (sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                        VALUES ('0x69');`;
          // Add notification subscription to account on chains 1, 2, 3
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                        VALUES (1, 1, 1, '0x420')`;
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                        VALUES (1, 2, 1, '0x420')`;
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                        VALUES (1, 3, 1, '0x420')`;
        });

        // Delete DELETED_MULTISIG_TRANSACTION notification type
        await sql`DELETE FROM notification_types WHERE name = 'DELETED_MULTISIG_TRANSACTION'`;

        return {
          notification_types: await sql<
            Array<NotificationTypesRow>
          >`SELECT * FROM notification_types`,
          notification_subscriptions: await sql<
            Array<NotificationSubscriptionsRow>
          >`SELECT * FROM notification_subscriptions`,
          notification_mediums: await sql<
            Array<NotificationMediumsRow>
          >`SELECT * FROM notification_mediums`,
          notification_medium_configurations: await sql<
            Array<NotificationMediumConfigurationsRow>
          >`SELECT * FROM notification_medium_configurations`,
        };
      },
    });

    expect(result.after).toStrictEqual({
      notification_types: [
        // DELETED_MULTISIG_TRANSACTION is deleted
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
          name: 'MESSAGE_CREATED',
        },
        {
          id: expect.any(Number),
          name: 'MODULE_TRANSACTION',
        },
        {
          id: expect.any(Number),
          name: 'NEW_CONFIRMATION',
        },
        {
          id: expect.any(Number),
          name: 'MESSAGE_CONFIRMATION',
        },
        {
          id: expect.any(Number),
          name: 'OUTGOING_ETHER',
        },
        {
          id: expect.any(Number),
          name: 'OUTGOING_TOKEN',
        },
        {
          id: expect.any(Number),
          name: 'PENDING_MULTISIG_TRANSACTION',
        },
        {
          id: expect.any(Number),
          name: 'SAFE_CREATED',
        },
      ],
      // No subscriptions should exist
      notification_subscriptions: [],
      notification_mediums: [
        {
          id: 1,
          name: 'PUSH_NOTIFICATIONS',
        },
      ],
      notification_medium_configurations: [],
    });
  });

  it('should delete the notification_medium_configuration if the notification_medium is deleted', async () => {
    const result = await migrator.test({
      migration: '00004_notifications',
      after: async (sql) => {
        await sql.begin(async (transaction) => {
          // Create account
          await transaction`INSERT INTO accounts (address)
                                        VALUES ('0x69');`;
          // Add notification subscription to account on chains 1, 2, 3
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                        VALUES (1, 1, 1, '0x420')`;
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                        VALUES (1, 2, 1, '0x420')`;
          await transaction`INSERT INTO notification_subscriptions (account_id, chain_id, notification_type_id, safe_address)
                                        VALUES (1, 3, 1, '0x420')`;

          // Enable notification medium
          await transaction`INSERT INTO notification_medium_configurations (notification_subscription_id, notification_medium_id, cloud_messaging_token)
                                        VALUES (1, 1, '69420')`;
        });

        // Delete PUSH_NOTIFICATIONS notification medium
        await sql`DELETE FROM notification_mediums WHERE name = 'PUSH_NOTIFICATIONS'`;

        return {
          notification_types: await sql<
            Array<NotificationTypesRow>
          >`SELECT * FROM notification_types`,
          notification_subscriptions: await sql<
            Array<NotificationSubscriptionsRow>
          >`SELECT * FROM notification_subscriptions`,
          notification_mediums: await sql<
            Array<NotificationMediumsRow>
          >`SELECT * FROM notification_mediums`,
          notification_medium_configurations: await sql<
            Array<NotificationMediumConfigurationsRow>
          >`SELECT * FROM notification_medium_configurations`,
        };
      },
    });

    expect(result.after).toStrictEqual({
      notification_types: [
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
          name: 'MESSAGE_CREATED',
        },
        {
          id: expect.any(Number),
          name: 'MODULE_TRANSACTION',
        },
        {
          id: expect.any(Number),
          name: 'NEW_CONFIRMATION',
        },
        {
          id: expect.any(Number),
          name: 'MESSAGE_CONFIRMATION',
        },
        {
          id: expect.any(Number),
          name: 'OUTGOING_ETHER',
        },
        {
          id: expect.any(Number),
          name: 'OUTGOING_TOKEN',
        },
        {
          id: expect.any(Number),
          name: 'PENDING_MULTISIG_TRANSACTION',
        },
        {
          id: expect.any(Number),
          name: 'SAFE_CREATED',
        },
      ],
      notification_subscriptions: [
        {
          id: 1,
          chain_id: 1,
          account_id: 1,
          notification_type_id: 1,
          safe_address: '0x420',
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: 2,
          chain_id: 2,
          account_id: 1,
          notification_type_id: 1,
          safe_address: '0x420',
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: 3,
          chain_id: 3,
          account_id: 1,
          notification_type_id: 1,
          safe_address: '0x420',
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ],
      notification_mediums: [],
      // No configurations should exist
      notification_medium_configurations: [],
    });
  });
});
