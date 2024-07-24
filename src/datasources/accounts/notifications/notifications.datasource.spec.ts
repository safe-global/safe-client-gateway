import { TestDbFactory } from '@/__tests__/db.factory';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AccountsDatasource } from '@/datasources/accounts/accounts.datasource';
import { upsertSubscriptionsDtoBuilder } from '@/domain/notifications/entities-v2/__tests__/upsert-subscriptions.dto.entity.builder';
import { NotificationsDatasource } from '@/datasources/accounts/notifications/notifications.datasource';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
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
    // Don't truncate notification_types as it has predefined rows
    await sql`TRUNCATE TABLE accounts, push_notification_devices, notification_subscriptions, notification_subscription_notification_types RESTART IDENTITY CASCADE`;
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  describe('upsertSubscriptions', () => {
    it('should insert a subscription', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('deviceUuid', undefined)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);

      const actual = await target.upsertSubscriptions(upsertSubscriptionsDto);

      expect(actual).toStrictEqual({ deviceUuid: expect.any(String) });

      // Ensure correct database structure
      await Promise.all([
        sql`SELECT * FROM accounts`,
        sql`SELECT * FROM push_notification_devices`,
        sql`SELECT * FROM notification_types`,
        sql`SELECT * FROM notification_subscriptions`,
        sql`SELECT * FROM notification_subscription_notification_types`,
      ]).then(
        ([
          accounts,
          devices,
          types,
          subscriptions,
          subscribedNotifications,
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
          expect(devices).toStrictEqual([
            {
              id: 1,
              device_type: upsertSubscriptionsDto.deviceType,
              device_uuid: actual.deviceUuid,
              cloud_messaging_token: upsertSubscriptionsDto.cloudMessagingToken,
              created_at: expect.any(Date),
              updated_at: expect.any(Date),
            },
          ]);
          expect(types).toStrictEqual(
            Object.values(NotificationType).map((type) => {
              return {
                id: expect.any(Number),
                name: type,
              };
            }),
          );
          expect(subscriptions).toStrictEqual(
            upsertSubscriptionsDto.safes.map((safe, i) => {
              return {
                id: i + 1,
                account_id: accounts[0].id,
                push_notification_device_id: devices[0].id,
                chain_id: safe.chainId,
                safe_address: safe.address,
                created_at: expect.any(Date),
                updated_at: expect.any(Date),
              };
            }),
          );
          expect(subscribedNotifications).toStrictEqual(
            expect.arrayContaining(
              upsertSubscriptionsDto.safes.flatMap((safe, i) => {
                return safe.notificationTypes.map((type) => {
                  return {
                    id: expect.any(Number),
                    notification_subscription_id: i + 1,
                    notification_type_id: types.find((t) => t.name === type)
                      ?.id,
                  };
                });
              }),
            ),
          );
        },
      );
    });

    it('should always update the deviceType/cloudMessagingToken', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      const secondSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('account', upsertSubscriptionsDto.account)
        .with('deviceUuid', upsertSubscriptionsDto.deviceUuid)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);

      // Insert should not throw despite it being the same device UUID
      await expect(
        target.upsertSubscriptions(secondSubscriptionsDto),
      ).resolves.not.toThrow();
      // Device UUID should have updated
      await expect(
        sql`SELECT * FROM push_notification_devices`,
      ).resolves.toStrictEqual([
        {
          id: 1,
          device_type: secondSubscriptionsDto.deviceType,
          device_uuid: expect.any(String),
          cloud_messaging_token: secondSubscriptionsDto.cloudMessagingToken,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ]);
    });

    it('should update a subscription, setting only the newly subscribed notification types', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('safes', [
          {
            chainId: faker.string.numeric(),
            address: getAddress(faker.finance.ethereumAddress()),
            notificationTypes: faker.helpers.arrayElements(
              Object.values(NotificationType),
            ),
          },
        ])
        .build();
      const newNotificationTypes = faker.helpers.arrayElements(
        Object.values(NotificationType),
      );
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);
      await target.upsertSubscriptions({
        ...upsertSubscriptionsDto,
        safes: [
          {
            ...upsertSubscriptionsDto.safes[0],
            notificationTypes: newNotificationTypes,
          },
        ],
      });

      await Promise.all([
        sql`SELECT * FROM notification_types`,
        sql`SELECT * FROM notification_subscription_notification_types`,
      ]).then(([notificationTypes, subscribedNotifications]) => {
        // Only new notification types should be subscribed to
        expect(subscribedNotifications).toStrictEqual(
          expect.arrayContaining(
            newNotificationTypes.map((type) => {
              return {
                id: expect.any(Number),
                notification_subscription_id: 1,
                notification_type_id: notificationTypes.find(
                  (t) => t.name === type,
                )?.id,
              };
            }),
          ),
        );
      });
    });

    it('should allow multiple subscriptions, varying by device UUID', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      const secondDeviceUuid = faker.string.uuid() as Uuid;
      const secondUpsertSubscriptionsDto = {
        ...upsertSubscriptionsDto,
        deviceUuid: secondDeviceUuid,
      };
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);
      await target.upsertSubscriptions(secondUpsertSubscriptionsDto);

      // Ensure correct database structure
      await Promise.all([
        sql`SELECT * FROM accounts`,
        sql`SELECT * FROM push_notification_devices`,
        sql`SELECT * FROM notification_types`,
        sql`SELECT * FROM notification_subscriptions`,
        sql`SELECT * FROM notification_subscription_notification_types`,
      ]).then(
        ([
          accounts,
          devices,
          types,
          subscriptions,
          subscribedNotifications,
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
          expect(devices).toStrictEqual([
            {
              id: 1,
              device_type: upsertSubscriptionsDto.deviceType,
              device_uuid: upsertSubscriptionsDto.deviceUuid,
              cloud_messaging_token: upsertSubscriptionsDto.cloudMessagingToken,
              created_at: expect.any(Date),
              updated_at: expect.any(Date),
            },
            {
              id: 2,
              device_type: upsertSubscriptionsDto.deviceType,
              device_uuid: secondDeviceUuid,
              cloud_messaging_token: upsertSubscriptionsDto.cloudMessagingToken,
              created_at: expect.any(Date),
              updated_at: expect.any(Date),
            },
          ]);
          expect(types).toStrictEqual(
            Object.values(NotificationType).map((type) => {
              return {
                id: expect.any(Number),
                name: type,
              };
            }),
          );
          expect(subscriptions).toStrictEqual(
            upsertSubscriptionsDto.safes
              .map((safe, i) => {
                return {
                  id: i + 1,
                  account_id: accounts[0].id,
                  push_notification_device_id: devices[0].id,
                  chain_id: safe.chainId,
                  safe_address: safe.address,
                  created_at: expect.any(Date),
                  updated_at: expect.any(Date),
                };
              })
              .concat(
                secondUpsertSubscriptionsDto.safes.map((safe, i) => {
                  return {
                    id: upsertSubscriptionsDto.safes.length + i + 1,
                    account_id: accounts[0].id,
                    push_notification_device_id: devices[1].id,
                    chain_id: safe.chainId,
                    safe_address: safe.address,
                    created_at: expect.any(Date),
                    updated_at: expect.any(Date),
                  };
                }),
              ),
          );
          expect(subscribedNotifications).toStrictEqual(
            expect.arrayContaining(
              upsertSubscriptionsDto.safes
                .flatMap((safe, i) => {
                  return safe.notificationTypes.map((type) => {
                    return {
                      id: expect.any(Number),
                      notification_subscription_id: i + 1,
                      notification_type_id: types.find((t) => t.name === type)
                        ?.id,
                    };
                  });
                })
                .concat(
                  secondUpsertSubscriptionsDto.safes.flatMap((safe, i) => {
                    return safe.notificationTypes.map((type) => {
                      return {
                        id: expect.any(Number),
                        notification_subscription_id:
                          upsertSubscriptionsDto.safes.length + i + 1,
                        notification_type_id: types.find((t) => t.name === type)
                          ?.id,
                      };
                    });
                  }),
                ),
            ),
          );
        },
      );
    });
  });

  describe('getSafeSubscription', () => {
    it('should return a subscription for a Safe', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);

      const safe = upsertSubscriptionsDto.safes[0];
      await expect(
        target.getSafeSubscription({
          account: upsertSubscriptionsDto.account,
          deviceUuid: upsertSubscriptionsDto.deviceUuid!,
          chainId: safe.chainId,
          safeAddress: safe.address,
        }),
      ).resolves.toStrictEqual(expect.arrayContaining(safe.notificationTypes));
    });
  });

  describe('getSubscribersWithTokensBySafe', () => {
    it('should return a list of subscribers with tokens for a Safe', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      const secondUpsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('safes', upsertSubscriptionsDto.safes)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await accountsDatasource.createAccount(
        secondUpsertSubscriptionsDto.account,
      );
      await target.upsertSubscriptions(upsertSubscriptionsDto);
      await target.upsertSubscriptions(secondUpsertSubscriptionsDto);

      const safe = upsertSubscriptionsDto.safes[0];
      await expect(
        target.getSubscribersBySafe({
          chainId: safe.chainId,
          safeAddress: safe.address,
        }),
      ).resolves.toStrictEqual([
        {
          subscriber: upsertSubscriptionsDto.account,
          deviceUuid: upsertSubscriptionsDto.deviceUuid!,
          cloudMessagingToken: upsertSubscriptionsDto.cloudMessagingToken,
        },
        {
          subscriber: secondUpsertSubscriptionsDto.account,
          deviceUuid: secondUpsertSubscriptionsDto.deviceUuid!,
          cloudMessagingToken: secondUpsertSubscriptionsDto.cloudMessagingToken,
        },
      ]);
    });
  });

  describe('deleteSubscription', () => {
    it('should delete a subscription and orphaned device', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('safes', [
          {
            chainId: faker.string.numeric(),
            address: getAddress(faker.finance.ethereumAddress()),
            notificationTypes: faker.helpers.arrayElements(
              Object.values(NotificationType),
            ),
          },
        ])
        .build();
      const account = await accountsDatasource.createAccount(
        upsertSubscriptionsDto.account,
      );
      await target.upsertSubscriptions(upsertSubscriptionsDto);

      const safe = upsertSubscriptionsDto.safes[0];
      await target.deleteSubscription({
        account: upsertSubscriptionsDto.account,
        deviceUuid: upsertSubscriptionsDto.deviceUuid!,
        chainId: safe.chainId,
        safeAddress: safe.address,
      });

      await expect(
        sql`SELECT * FROM notification_subscriptions WHERE account_id = ${account.id} AND chain_id = ${safe.chainId} AND safe_address = ${safe.address}`,
      ).resolves.toStrictEqual([]);
      await expect(
        sql`SELECT * FROM push_notification_devices WHERE device_uuid = ${upsertSubscriptionsDto.deviceUuid!}`,
      ).resolves.toStrictEqual([]);
    });

    it('should not delete subscriptions of other device UUIDs', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('safes', [
          {
            chainId: faker.string.numeric(),
            address: getAddress(faker.finance.ethereumAddress()),
            notificationTypes: faker.helpers.arrayElements(
              Object.values(NotificationType),
            ),
          },
        ])
        .build();
      const secondDeviceUuid = faker.string.uuid() as Uuid;
      const secondUpsertSubscriptionsDto = {
        ...upsertSubscriptionsDto,
        deviceUuid: secondDeviceUuid,
      };
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);
      await target.upsertSubscriptions(secondUpsertSubscriptionsDto);

      const safe = upsertSubscriptionsDto.safes[0];
      await target.deleteSubscription({
        account: upsertSubscriptionsDto.account,
        deviceUuid: upsertSubscriptionsDto.deviceUuid!,
        chainId: safe.chainId,
        safeAddress: safe.address,
      });

      // The second subscription should remain
      await expect(
        sql`SELECT * FROM notification_subscriptions`,
      ).resolves.toStrictEqual([
        {
          id: 2,
          account_id: 1,
          push_notification_device_id: 2,
          chain_id: safe.chainId,
          safe_address: safe.address,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ]);
    });

    it('should not delete devices with other subscriptions', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('safes', [
          {
            chainId: faker.string.numeric(),
            address: getAddress(faker.finance.ethereumAddress()),
            notificationTypes: faker.helpers.arrayElements(
              Object.values(NotificationType),
            ),
          },
          {
            chainId: faker.string.numeric(),
            address: getAddress(faker.finance.ethereumAddress()),
            notificationTypes: faker.helpers.arrayElements(
              Object.values(NotificationType),
            ),
          },
        ])
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);

      const safe = upsertSubscriptionsDto.safes[0];
      await target.deleteSubscription({
        account: upsertSubscriptionsDto.account,
        deviceUuid: upsertSubscriptionsDto.deviceUuid!,
        chainId: safe.chainId,
        safeAddress: safe.address,
      });

      // Device should not have been deleted
      await expect(
        sql`SELECT * FROM push_notification_devices`,
      ).resolves.toStrictEqual([
        {
          id: 1,
          device_type: upsertSubscriptionsDto.deviceType,
          device_uuid: upsertSubscriptionsDto.deviceUuid,
          cloud_messaging_token: upsertSubscriptionsDto.cloudMessagingToken,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ]);
    });
  });

  describe('deleteDevice', () => {
    it('should delete all subscriptions of a device', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);

      await target.deleteDevice(upsertSubscriptionsDto.deviceUuid!);

      // All subscriptions of the device should be deleted
      await expect(
        sql`SELECT * FROM notification_subscriptions`,
      ).resolves.toStrictEqual([]);
    });
  });
});
