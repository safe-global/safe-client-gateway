import { TestDbFactory } from '@/__tests__/db.factory';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AccountsDatasource } from '@/datasources/accounts/accounts.datasource';
import { upsertSubscriptionsDtoBuilder } from '@/datasources/accounts/notifications/__tests__/upsert-subscriptions.dto.entity.builder';
import { NotificationsDatasource } from '@/datasources/accounts/notifications/notifications.datasource';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { NotificationChannel } from '@/domain/notifications/entities-v2/notification-channel.entity';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { isEqual } from 'lodash';
import postgres from 'postgres';
import { getAddress } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('NotificationsDatasource', () => {
  let fakeCacheService: FakeCacheService;
  let accountsDatasource: AccountsDatasource;
  let migrator: PostgresDatabaseMigrator;
  let sql: postgres.Sql;
  const testDbFactory = new TestDbFactory();
  let target: NotificationsDatasource;

  beforeAll(async () => {
    fakeCacheService = new FakeCacheService();
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
    });
    accountsDatasource = new AccountsDatasource(
      fakeCacheService,
      sql,
      mockLoggingService,
      mockConfigurationService,
    );
    target = new NotificationsDatasource(
      sql,
      mockLoggingService,
      accountsDatasource,
    );
  });

  afterEach(async () => {
    // Don't truncate notification_types or notification_channels as they have predefined rows
    await sql`TRUNCATE TABLE accounts, notification_subscriptions, notification_subscription_notification_types, notification_channel_configurations RESTART IDENTITY CASCADE`;
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  describe('upsertSubscriptions', () => {
    it('should insert subscriptions', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('deviceUuid', undefined)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);

      const actual = await target.upsertSubscriptions(upsertSubscriptionsDto);

      expect(actual).toStrictEqual({ deviceUuid: expect.any(String) });

      // Ensure correct database structure
      await Promise.all([
        sql`SELECT * FROM accounts`,
        sql`SELECT * FROM notification_subscriptions`,
        sql`SELECT * FROM notification_subscription_notification_types`,
        sql`SELECT * from notification_types`,
        sql`SELECT * FROM notification_channels`,
        sql`SELECT * FROM notification_channel_configurations`,
      ]).then(
        ([
          accounts,
          subscriptions,
          subscribedNotificationTypes,
          notificationTypes,
          channels,
          channelsConfigs,
        ]) => {
          expect(accounts).toStrictEqual([
            {
              id: 1,
              group_id: null,
              address: upsertSubscriptionsDto.account,
              created_at: expect.any(Date),
              updated_at: expect.any(Date),
            },
          ]);
          expect(subscriptions).toStrictEqual(
            upsertSubscriptionsDto.safes.map((subscription, i) => {
              return {
                id: i + 1,
                account_id: 1,
                chain_id: subscription.chainId,
                safe_address: subscription.address,
                created_at: expect.any(Date),
                updated_at: expect.any(Date),
              };
            }),
          );
          expect(subscribedNotificationTypes).toStrictEqual(
            upsertSubscriptionsDto.safes.flatMap((subscription, i) => {
              return subscription.notificationTypes.map(() => {
                return {
                  id: expect.any(Number),
                  subscription_id: i + 1,
                  notification_type_id: expect.any(Number),
                };
              });
            }),
          );
          expect(notificationTypes).toStrictEqual(
            Object.values(NotificationType).map((type) => {
              return {
                id: expect.any(Number),
                name: type,
              };
            }),
          );
          expect(channels).toStrictEqual([
            {
              id: 1,
              name: NotificationChannel.PUSH_NOTIFICATIONS,
            },
          ]);
          expect(channelsConfigs).toStrictEqual(
            upsertSubscriptionsDto.safes.map((_, i) => {
              return {
                id: i + 1,
                notification_subscription_id: i + 1,
                notification_channel_id: 1,
                cloud_messaging_token:
                  upsertSubscriptionsDto.cloudMessagingToken,
                device_type: upsertSubscriptionsDto.deviceType,
                device_uuid: actual.deviceUuid,
                created_at: expect.any(Date),
                updated_at: expect.any(Date),
              };
            }),
          );
        },
      );
    });

    it('should update subscriptions with new preferences', async () => {
      const deviceUuid = faker.string.uuid() as Uuid;
      const chainId = faker.string.numeric();
      const safeAddress1 = getAddress(faker.finance.ethereumAddress());
      const safeAddress2 = getAddress(faker.finance.ethereumAddress());
      const notificationTypes1 = faker.helpers.arrayElements(
        Object.values(NotificationType),
      );
      const notificationTypes2 = faker.helpers.arrayElements(
        Object.values(NotificationType),
      );
      const notificationTypes2Upserted = faker.helpers.arrayElements(
        Object.values(NotificationType),
      );
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('safes', [
          {
            address: safeAddress1,
            chainId,
            notificationTypes: notificationTypes1,
          },
          {
            address: safeAddress2,
            chainId,
            notificationTypes: notificationTypes2,
          },
        ])
        .with('deviceUuid', deviceUuid)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);
      const safeSubscription = await target.getSafeSubscription({
        account: upsertSubscriptionsDto.account,
        chainId: upsertSubscriptionsDto.safes[0].chainId,
        safeAddress: upsertSubscriptionsDto.safes[0].address,
        deviceUuid: deviceUuid,
      });

      expect(safeSubscription).toEqual(
        Object.values(NotificationType).reduce<
          Record<NotificationType, boolean>
        >(
          (acc, type) => {
            acc[type] =
              upsertSubscriptionsDto.safes[0].notificationTypes.includes(type);
            return acc;
          },
          {} as Record<NotificationType, boolean>,
        ),
      );

      const upsertedUpsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('account', upsertSubscriptionsDto.account)
        .with('cloudMessagingToken', upsertSubscriptionsDto.cloudMessagingToken)
        .with('deviceType', upsertSubscriptionsDto.deviceType)
        .with('deviceUuid', upsertSubscriptionsDto.deviceUuid)
        .with('safes', [
          {
            address: safeAddress2,
            chainId,
            notificationTypes: notificationTypes2Upserted,
          },
        ])
        .build();
      await target.upsertSubscriptions(upsertedUpsertSubscriptionsDto);
      const upsertedSafeSubscription = await target.getSafeSubscription({
        account: upsertedUpsertSubscriptionsDto.account,
        chainId: upsertedUpsertSubscriptionsDto.safes[0].chainId,
        safeAddress: upsertedUpsertSubscriptionsDto.safes[0].address,
        deviceUuid: deviceUuid,
      });

      expect(upsertedSafeSubscription).toEqual(
        Object.values(NotificationType).reduce<
          Record<NotificationType, boolean>
        >(
          (acc, type) => {
            acc[type] =
              upsertedUpsertSubscriptionsDto.safes[0].notificationTypes.includes(
                type,
              );
            return acc;
          },
          {} as Record<NotificationType, boolean>,
        ),
      );

      expect(
        isEqual(
          Object.values(safeSubscription).sort(),
          Object.values(upsertedSafeSubscription).sort(),
        ),
      ).toBe(false);
    });
  });

  describe('getSafeSubscription', () => {
    it('should get the Safe subscription', async () => {
      const deviceUuid = faker.string.uuid() as Uuid;
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('deviceUuid', deviceUuid)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);

      await Promise.all(
        upsertSubscriptionsDto.safes.map(async (safe) => {
          const actual = await target.getSafeSubscription({
            account: upsertSubscriptionsDto.account,
            chainId: safe.chainId,
            safeAddress: safe.address,
            deviceUuid,
          });

          expect(actual).toEqual(
            Object.values(NotificationType).reduce<
              Record<NotificationType, boolean>
            >(
              (acc, type) => {
                acc[type] = safe.notificationTypes.includes(type);
                return acc;
              },
              {} as Record<NotificationType, boolean>,
            ),
          );
        }),
      );
    });
  });

  describe('getSubscribersWithTokensBySafe', () => {
    it('should get the subscribers with cloud messaging token for a Safe', async () => {
      const deviceUuid = faker.string.uuid() as Uuid;
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('deviceUuid', deviceUuid)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);

      await Promise.all(
        upsertSubscriptionsDto.safes.map((safe) => {
          return expect(
            target.getSubscribersWithTokensBySafe({
              chainId: safe.chainId,
              safeAddress: safe.address,
            }),
          ).resolves.toEqual([
            {
              subscriber: upsertSubscriptionsDto.account,
              cloudMessagingToken: upsertSubscriptionsDto.cloudMessagingToken,
            },
          ]);
        }),
      );
    });
  });

  describe('deleteSubscription', () => {
    it('should delete a subscription', async () => {
      const deviceUuid = faker.string.uuid() as Uuid;
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('deviceUuid', deviceUuid)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);

      await target.deleteSubscription({
        account: upsertSubscriptionsDto.account,
        chainId: upsertSubscriptionsDto.safes[0].chainId,
        safeAddress: upsertSubscriptionsDto.safes[0].address,
      });

      await expect(
        target.getSafeSubscription({
          account: upsertSubscriptionsDto.account,
          chainId: upsertSubscriptionsDto.safes[0].chainId,
          safeAddress: upsertSubscriptionsDto.safes[0].address,
          deviceUuid,
        }),
      ).rejects.toThrow('Error getting account subscription');

      const remainingSubscriptions = upsertSubscriptionsDto.safes.filter(
        (safe) => {
          return safe.address !== upsertSubscriptionsDto.safes[0].address;
        },
      );

      // Ensure correct database structure
      await Promise.all([
        sql`SELECT * FROM accounts`,
        sql`SELECT * FROM notification_subscriptions`,
        sql`SELECT * FROM notification_subscription_notification_types`,
        sql`SELECT * from notification_types`,
        sql`SELECT * FROM notification_channels`,
        sql`SELECT * FROM notification_channel_configurations`,
      ]).then(
        ([
          accounts,
          subscriptions,
          subscribedNotificationTypes,
          notificationTypes,
          channels,
          channelsConfigs,
        ]) => {
          expect(accounts).toStrictEqual([
            {
              id: 1,
              group_id: null,
              address: upsertSubscriptionsDto.account,
              created_at: expect.any(Date),
              updated_at: expect.any(Date),
            },
          ]);
          expect(subscriptions).toStrictEqual(
            remainingSubscriptions.map((subscription) => {
              return {
                id: expect.any(Number),
                account_id: 1,
                chain_id: subscription.chainId,
                safe_address: subscription.address,
                created_at: expect.any(Date),
                updated_at: expect.any(Date),
              };
            }),
          );
          expect(subscribedNotificationTypes).toStrictEqual(
            remainingSubscriptions.flatMap((subscription) => {
              return subscription.notificationTypes.map(() => {
                return {
                  id: expect.any(Number),
                  subscription_id: expect.any(Number),
                  notification_type_id: expect.any(Number),
                };
              });
            }),
          );
          expect(notificationTypes).toStrictEqual(
            Object.values(NotificationType).map((type) => {
              return {
                id: expect.any(Number),
                name: type,
              };
            }),
          );
          expect(channels).toStrictEqual([
            {
              id: 1,
              name: NotificationChannel.PUSH_NOTIFICATIONS,
            },
          ]);
          expect(channelsConfigs).toStrictEqual(
            remainingSubscriptions.map(() => {
              return {
                id: expect.any(Number),
                notification_subscription_id: expect.any(Number),
                notification_channel_id: 1,
                cloud_messaging_token:
                  upsertSubscriptionsDto.cloudMessagingToken,
                device_type: upsertSubscriptionsDto.deviceType,
                device_uuid: deviceUuid,
                created_at: expect.any(Date),
                updated_at: expect.any(Date),
              };
            }),
          );
        },
      );
    });
  });

  describe('deleteDevice', () => {
    it('should delete a device', async () => {
      const deviceUuid = faker.string.uuid() as Uuid;
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('deviceUuid', deviceUuid)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);
      await target.deleteDevice(deviceUuid);

      await Promise.all(
        upsertSubscriptionsDto.safes.map((safe) => {
          return expect(
            target.getSafeSubscription({
              account: upsertSubscriptionsDto.account,
              chainId: safe.chainId,
              safeAddress: safe.address,
              deviceUuid,
            }),
          ).rejects.toThrow('Error getting account subscription');
        }),
      );

      // Ensure correct database structure
      await Promise.all([
        sql`SELECT * FROM accounts`,
        sql`SELECT * FROM notification_subscriptions`,
        sql`SELECT * FROM notification_subscription_notification_types`,
        sql`SELECT * from notification_types`,
        sql`SELECT * FROM notification_channels`,
        sql`SELECT * FROM notification_channel_configurations`,
      ]).then(
        ([
          accounts,
          subscriptions,
          subscribedNotificationTypes,
          notificationTypes,
          channels,
          channelsConfigs,
        ]) => {
          expect(accounts).toStrictEqual([
            {
              id: 1,
              group_id: null,
              address: upsertSubscriptionsDto.account,
              created_at: expect.any(Date),
              updated_at: expect.any(Date),
            },
          ]);
          expect(subscriptions).toStrictEqual([]);
          expect(subscribedNotificationTypes).toStrictEqual([]);
          expect(notificationTypes).toStrictEqual(
            Object.values(NotificationType).map((type) => {
              return {
                id: expect.any(Number),
                name: type,
              };
            }),
          );
          expect(channels).toStrictEqual([
            {
              id: 1,
              name: NotificationChannel.PUSH_NOTIFICATIONS,
            },
          ]);
          expect(channelsConfigs).toStrictEqual([]);
        },
      );
    });
  });
});
