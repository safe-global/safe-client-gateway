import { TestDbFactory } from '@/__tests__/db.factory';
import { AccountsDatasource } from '@/datasources/accounts/accounts.datasource';
import { upsertSubscriptionsDtoBuilder } from '@/datasources/accounts/notifications/__tests__/upsert-subscriptions.dto.entity.builder';
import { NotificationsDatasource } from '@/datasources/accounts/notifications/notifications.datasource';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import postgres from 'postgres';

const mockLoggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('NotificationsDatasource', () => {
  let accountsDatasource: AccountsDatasource;
  let target: NotificationsDatasource;
  let migrator: PostgresDatabaseMigrator;
  let sql: postgres.Sql;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    accountsDatasource = new AccountsDatasource(sql, mockLoggingService);
    target = new NotificationsDatasource(
      sql,
      mockLoggingService,
      accountsDatasource,
    );
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

      // TODO: Check database structure
    });

    it('should update subscriptions with new preferences', async () => {
      const deviceUuid = faker.string.uuid() as Uuid;
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('deviceUuid', deviceUuid)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);

      await expect(
        target.getSafeSubscription({
          account: upsertSubscriptionsDto.account,
          chainId: upsertSubscriptionsDto.safes[0].chainId,
          safeAddress: upsertSubscriptionsDto.safes[0].address,
          deviceUuid: deviceUuid,
        }),
      ).resolves.toEqual(
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

      const upsertedUpsertSubscriptionsDto = {
        ...upsertSubscriptionsDto,
        safes: [
          {
            chainId: upsertSubscriptionsDto.safes[0].chainId,
            address: upsertSubscriptionsDto.safes[0].address,
            notificationTypes: faker.helpers.arrayElements(
              Object.values(NotificationType),
            ),
          },
        ],
      };

      await target.upsertSubscriptions(upsertedUpsertSubscriptionsDto);

      await expect(
        target.getSafeSubscription({
          account: upsertSubscriptionsDto.account,
          chainId: upsertSubscriptionsDto.safes[0].chainId,
          safeAddress: upsertSubscriptionsDto.safes[0].address,
          deviceUuid: deviceUuid,
        }),
      ).resolves.toEqual(
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

      // TODO: Check new preferences in database
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

  describe('getCloudMessagingTokensBySafe', () => {
    it('should get the cloud messaging tokens subscribed to a Safe', async () => {
      const deviceUuid = faker.string.uuid() as Uuid;
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with('deviceUuid', deviceUuid)
        .build();
      await accountsDatasource.createAccount(upsertSubscriptionsDto.account);
      await target.upsertSubscriptions(upsertSubscriptionsDto);

      await Promise.all(
        upsertSubscriptionsDto.safes.map((safe) => {
          return expect(
            target.getCloudMessagingTokensBySafe({
              chainId: safe.chainId,
              safeAddress: safe.address,
            }),
          ).resolves.toEqual([upsertSubscriptionsDto.cloudMessagingToken]);
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

      // TODO: Check database structure
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

      // TODO: Check database structure
    });
  });
});
