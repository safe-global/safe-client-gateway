import type { UUID } from 'crypto';
import { faker } from '@faker-js/faker/.';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { type ILoggingService } from '@/logging/logging.interface';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { NotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository';
import type { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import type { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';
import type { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import { notificationTypeBuilder } from '@/datasources/notifications/entities/__tests__/notification-type.entity.db.builder';
import { notificationSubscriptionBuilder } from '@/datasources/notifications/entities/__tests__/notification-subscription.entity.db.builder';
import { NotificationSubscription } from '@/datasources/notifications/entities/notification-subscription.entity.db';
import { upsertSubscriptionsDtoBuilder } from '@/routes/notifications/v2/entities/__tests__/upsert-subscriptions.dto.builder';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { NotificationDevice } from '@/datasources/notifications/entities/notification-devices.entity.db';
import { mockEntityManager } from '@/datasources/db/v2/__tests__/entity-manager.mock';
import { mockPostgresDatabaseService } from '@/datasources/db/v2/__tests__/postgresql-database.service.mock';
import { mockRepository } from '@/datasources/db/v2/__tests__/repository.mock';
import { getAddress } from 'viem';
import { IsNull } from 'typeorm';
import { deleteAllSubscriptionsDtoBuilder } from '@/domain/notifications/v2/entities/__tests__/delete-all-subscriptions.dto.builder';
import type { ConfigService } from '@nestjs/config';

describe('NotificationsRepositoryV2', () => {
  let notificationsRepository: INotificationsRepositoryV2;
  const notificationTypeRepository = { ...mockRepository };
  const notificationDeviceRepository = { ...mockRepository };
  const notificationSubscriptionRepository = { ...mockRepository };
  const notificationSubscriptionsRepository = { ...mockRepository };
  const mockLoggingService = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  } as jest.MockedObjectDeep<ILoggingService>;
  const mockPushNotificationsApi: IPushNotificationsApi = {
    enqueueNotification: jest.fn(),
  };
  const mockConfigService = {
    getOrThrow: jest.fn(),
  } as jest.MockedObjectDeep<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationsRepository = new NotificationsRepositoryV2(
      mockPushNotificationsApi,
      mockLoggingService,
      mockPostgresDatabaseService,
      mockConfigService,
    );
  });

  describe('upsertSubscription()', () => {
    const deviceId = 1;
    beforeEach(() => {
      mockEntityManager.upsert.mockResolvedValue({
        identifiers: [
          {
            id: deviceId,
          },
        ],
        generatedMaps: [
          {
            id: deviceId,
          },
        ],
        raw: jest.fn(),
      });
      mockEntityManager.findOneOrFail.mockResolvedValue({
        id: deviceId,
      });
    });

    it('Should insert a new device when upserting a subscription', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      const mockNotificationTypes = Array.from({ length: 4 }, () =>
        notificationTypeBuilder().build(),
      );
      const mockSubscriptions = Array.from({ length: 4 }, () =>
        notificationSubscriptionBuilder().build(),
      );
      mockEntityManager.find.mockResolvedValue(mockNotificationTypes);
      notificationSubscriptionRepository.find.mockResolvedValue(
        mockSubscriptions,
      );
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationTypeRepository,
      );

      await notificationsRepository.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto: upsertSubscriptionsDto,
      });

      expect(mockPostgresDatabaseService.transaction).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.upsert).toHaveBeenNthCalledWith(
        1,
        NotificationDevice,
        {
          device_uuid: upsertSubscriptionsDto.deviceUuid,
          device_type: upsertSubscriptionsDto.deviceType,
          cloud_messaging_token: upsertSubscriptionsDto.cloudMessagingToken,
        },
        {
          conflictPaths: ['device_uuid'],
          skipUpdateIfNoValuesChanged: true,
        },
      );
    });

    it('Should delete previous subscriptions when upserting a new one', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      const mockNotificationTypes = Array.from({ length: 4 }, () =>
        notificationTypeBuilder().build(),
      );
      mockEntityManager.find.mockResolvedValue(mockNotificationTypes);

      await notificationsRepository.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto: upsertSubscriptionsDto,
      });

      expect(mockPostgresDatabaseService.transaction).toHaveBeenCalledTimes(1);
      expect(
        mockEntityManager.createQueryBuilder().delete().from,
      ).toHaveBeenNthCalledWith(1, NotificationSubscription);
      for (const [index, safe] of upsertSubscriptionsDto.safes.entries()) {
        const nthTime = index + 1; // Index is zero based for that reason we need to add 1 to it
        expect(
          mockEntityManager
            .createQueryBuilder()
            .delete()
            .from(NotificationSubscription).where,
        ).toHaveBeenNthCalledWith(
          nthTime,
          `chain_id = :chainId
          AND safe_address = :safeAddress
          AND push_notification_device.id = :deviceId
          AND (
            signer_address = :signerAddress OR signer_address IS NULL
          )`,
          {
            chainId: safe.chainId,
            safeAddress: safe.address,
            deviceId: deviceId,
            signerAddress: authPayload.signer_address ?? null,
          },
        );
      }
    });

    it('Should insert the subscription object when upserting a new subscription', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      await notificationsRepository.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto: upsertSubscriptionsDto,
      });

      const subscriptionsToInsert: Array<Partial<NotificationSubscription>> =
        [];
      for (const safe of upsertSubscriptionsDto.safes) {
        const device = new NotificationDevice();
        device.id = deviceId;
        subscriptionsToInsert.push({
          chain_id: safe.chainId,
          safe_address: safe.address,
          signer_address: authPayload.signer_address ?? null,
          push_notification_device: device,
        });
      }

      expect(mockPostgresDatabaseService.transaction).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.upsert).toHaveBeenNthCalledWith(
        2,
        NotificationSubscription,
        subscriptionsToInsert,
        {
          conflictPaths: [
            'chain_id',
            'safe_address',
            'signer_address',
            'push_notification_device',
          ],
          skipUpdateIfNoValuesChanged: true,
        },
      );
    });

    it('Should insert the notification subscription type object when upserting a new subscription', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      await notificationsRepository.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto: upsertSubscriptionsDto,
      });

      const subscriptionsToInsert: Array<Partial<NotificationSubscription>> =
        [];
      for (const safe of upsertSubscriptionsDto.safes) {
        const device = new NotificationDevice();
        device.id = deviceId;
        subscriptionsToInsert.push({
          chain_id: safe.chainId,
          safe_address: safe.address,
          signer_address: authPayload.signer_address ?? null,
          push_notification_device: device,
        });
      }

      expect(mockPostgresDatabaseService.transaction).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.upsert).toHaveBeenCalledTimes(3);
      // @TODO expect(mockEntityManager.upsert).toHaveBeenCalledWith();
    });
  });

  describe('getSafeSubscription()', () => {
    it('Should return a notification type', async () => {
      const mockNotificationTypes = Array.from({ length: 4 }, () =>
        notificationTypeBuilder().build(),
      );
      notificationTypeRepository.find.mockResolvedValue(mockNotificationTypes);
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationTypeRepository,
      );

      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);

      const args = {
        authPayload: authPayload,
        deviceUuid: faker.string.uuid() as UUID,
        chainId: authPayload.chain_id as string,
        safeAddress: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
      };

      const result = await notificationsRepository.getSafeSubscription(args);

      expect(notificationTypeRepository.find).toHaveBeenCalledWith({
        select: { name: true },
        where: {
          notification_subscription_notification_type: {
            notification_subscription: {
              push_notification_device: { device_uuid: args.deviceUuid },
              chain_id: args.chainId,
              safe_address: args.safeAddress,
              signer_address: args.authPayload.signer_address,
            },
          },
        },
      });
      expect(result).toEqual(mockNotificationTypes);
    });

    it('Should throw UnauthorizedException if signer_address is not passed', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', '' as `0x${string}`)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);

      const args = {
        authPayload,
        deviceUuid: faker.string.uuid() as UUID,
        chainId: authPayload.chain_id as string,
        safeAddress: faker.string.hexadecimal({
          length: 32,
        }) as `0x${string}`,
      };
      const result = notificationsRepository.getSafeSubscription(args);

      await expect(result).rejects.toThrow(UnauthorizedException);
    });

    it('Should return an empty array if there is no notification type for safe', async () => {
      const mockNotificationTypes: Array<NotificationType> = [];
      notificationTypeRepository.find.mockResolvedValue(mockNotificationTypes);
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationTypeRepository,
      );

      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);

      const args = {
        authPayload: authPayload,
        deviceUuid: faker.string.uuid() as UUID,
        chainId: authPayload.chain_id as string,
        safeAddress: faker.string.hexadecimal({
          length: 32,
        }) as `0x${string}`,
      };
      const result = await notificationsRepository.getSafeSubscription(args);

      expect(notificationTypeRepository.find).toHaveBeenCalledWith({
        select: { name: true },
        where: {
          notification_subscription_notification_type: {
            notification_subscription: {
              push_notification_device: { device_uuid: args.deviceUuid },
              chain_id: args.chainId,
              safe_address: args.safeAddress,
              signer_address: args.authPayload.signer_address,
            },
          },
        },
      });
      expect(result).toEqual(mockNotificationTypes);
    });
  });

  describe('getSubscribersBySafe()', () => {
    it('Should successfully return subscribers by safe', async () => {
      const mockSubscribers = Array.from(
        { length: 5 },
        (): NotificationSubscription =>
          notificationSubscriptionBuilder().build(),
      );
      notificationSubscriptionsRepository.find.mockResolvedValue(
        mockSubscribers,
      );
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionsRepository,
      );

      const result = await notificationsRepository.getSubscribersBySafe({
        chainId: faker.number.int({ min: 1, max: 100 }).toString(),
        safeAddress: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
      });

      const output = mockSubscribers.map(
        (subscription: NotificationSubscription) => {
          return {
            subscriber: subscription.signer_address,
            deviceUuid: subscription.push_notification_device.device_uuid,
            cloudMessagingToken:
              subscription.push_notification_device.cloud_messaging_token,
          };
        },
      );

      expect(result).toEqual(output);
    });

    it('Should return empty when there is no subscribers for safe', async () => {
      notificationSubscriptionsRepository.find.mockResolvedValue([]);
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionsRepository,
      );

      const result = await notificationsRepository.getSubscribersBySafe({
        chainId: faker.number.int({ min: 1, max: 100 }).toString(),
        safeAddress: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
      });

      expect(result).toEqual([]);
    });
  });

  describe('deleteSubscription()', () => {
    it('Should remove a subscription successfully', async () => {
      const mockNotificationSubscription =
        notificationSubscriptionBuilder().build();

      notificationSubscriptionRepository.findOne.mockResolvedValue(
        mockNotificationSubscription,
      );

      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionRepository,
      );

      const args = {
        deviceUuid: faker.string.uuid() as UUID,
        chainId: faker.number.int({ min: 0 }).toString(),
        safeAddress: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
      };

      await notificationsRepository.deleteSubscription(args);

      expect(notificationSubscriptionRepository.findOne).toHaveBeenCalledTimes(
        1,
      );
      expect(notificationSubscriptionRepository.findOne).toHaveBeenCalledWith({
        where: {
          chain_id: args.chainId,
          safe_address: args.safeAddress,
          push_notification_device: {
            device_uuid: args.deviceUuid,
          },
        },
      });
      expect(notificationSubscriptionRepository.remove).toHaveBeenCalledTimes(
        1,
      );
      expect(notificationSubscriptionRepository.remove).toHaveBeenCalledWith(
        mockNotificationSubscription,
      );
    });

    it('Should not call remove if no subscription is found', async () => {
      notificationSubscriptionRepository.findOne.mockResolvedValue(null);
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionRepository,
      );

      const args = {
        deviceUuid: faker.string.uuid() as UUID,
        chainId: faker.number.int({ min: 0 }).toString(),
        safeAddress: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
      };

      const result = notificationsRepository.deleteSubscription(args);

      await expect(result).rejects.toThrow();
      expect(notificationSubscriptionRepository.findOne).toHaveBeenCalledTimes(
        1,
      );
      expect(notificationSubscriptionRepository.findOne).toHaveBeenCalledWith({
        where: {
          chain_id: args.chainId,
          safe_address: args.safeAddress,
          push_notification_device: {
            device_uuid: args.deviceUuid,
          },
        },
      });
      expect(notificationSubscriptionRepository.remove).not.toHaveBeenCalled();
    });

    it('Should throw NotFoundException if no subscription is found', async () => {
      notificationSubscriptionRepository.findOne.mockResolvedValue(null);
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionRepository,
      );

      const args = {
        deviceUuid: faker.string.uuid() as UUID,
        chainId: faker.number.int({ min: 0 }).toString(),
        safeAddress: getAddress(faker.finance.ethereumAddress()),
      };

      const result = notificationsRepository.deleteSubscription(args);

      await expect(result).rejects.toThrow(
        new NotFoundException('No Subscription Found!'),
      );
      expect(notificationSubscriptionRepository.findOne).toHaveBeenCalledTimes(
        1,
      );
      expect(notificationSubscriptionRepository.findOne).toHaveBeenCalledWith({
        where: {
          chain_id: args.chainId,
          safe_address: args.safeAddress,
          push_notification_device: {
            device_uuid: args.deviceUuid,
          },
        },
      });
    });
  });

  describe('deleteDevice()', () => {
    it('Should delete a device successfully', async () => {
      notificationDeviceRepository.delete.mockResolvedValue({
        affected: 1,
        raw: [],
      });
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationDeviceRepository,
      );

      const deviceUuid = faker.string.uuid() as UUID;

      await notificationsRepository.deleteDevice(deviceUuid);

      expect(notificationDeviceRepository.delete).toHaveBeenCalled();
      expect(notificationDeviceRepository.delete).toHaveBeenCalledWith({
        device_uuid: deviceUuid,
      });
    });

    it('Should throw if a device uuid does not exist', async () => {
      notificationDeviceRepository.delete.mockResolvedValue({
        affected: 0,
        raw: [],
      });
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationDeviceRepository,
      );

      const deviceUuid = faker.string.uuid() as UUID;

      const result = notificationsRepository.deleteDevice(deviceUuid);

      await expect(result).rejects.toThrow(
        new NotFoundException('No Device Found!'),
      );
      expect(notificationDeviceRepository.delete).toHaveBeenCalled();
      expect(notificationDeviceRepository.delete).toHaveBeenCalledWith({
        device_uuid: deviceUuid,
      });
    });
  });

  describe('deleteAllSubscriptions()', () => {
    it('Should delete all subscriptions successfully', async () => {
      const mockSubscriptions = Array.from({ length: 3 }, () =>
        notificationSubscriptionBuilder().build(),
      );
      const deleteAllSubscriptionsDto = [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
      ];

      notificationSubscriptionsRepository.find.mockResolvedValue(
        mockSubscriptions,
      );
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionsRepository,
      );

      const args = {
        subscriptions: deleteAllSubscriptionsDto,
      };

      await notificationsRepository.deleteAllSubscriptions(args);

      expect(notificationSubscriptionsRepository.find).toHaveBeenCalledTimes(1);
      expect(notificationSubscriptionsRepository.find).toHaveBeenCalledWith({
        where: deleteAllSubscriptionsDto.map((subscription) => ({
          chain_id: subscription.chainId,
          safe_address: subscription.safeAddress,
          push_notification_device: {
            device_uuid: subscription.deviceUuid,
          },
        })),
      });
      expect(notificationSubscriptionsRepository.remove).toHaveBeenCalledTimes(
        1,
      );
      expect(notificationSubscriptionsRepository.remove).toHaveBeenCalledWith(
        mockSubscriptions,
      );
    });

    it('Should throw NotFoundException if no subscriptions are found', async () => {
      const deleteAllSubscriptionsDto = [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
      ];

      notificationSubscriptionsRepository.find.mockResolvedValue([]);
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionsRepository,
      );

      const args = {
        subscriptions: deleteAllSubscriptionsDto,
      };

      const result = notificationsRepository.deleteAllSubscriptions(args);

      await expect(result).rejects.toThrow(
        new NotFoundException('No Subscription Found!'),
      );
      expect(notificationSubscriptionsRepository.find).toHaveBeenCalledTimes(1);
      expect(notificationSubscriptionsRepository.remove).not.toHaveBeenCalled();
    });

    it('Should clear cache for each subscription after deletion', async () => {
      const mockSubscriptions = Array.from({ length: 2 }, () =>
        notificationSubscriptionBuilder().build(),
      );
      const deleteAllSubscriptionsDto = [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
      ];

      notificationSubscriptionsRepository.find.mockResolvedValue(
        mockSubscriptions,
      );
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionsRepository,
      );

      const args = {
        subscriptions: deleteAllSubscriptionsDto,
      };

      await notificationsRepository.deleteAllSubscriptions(args);

      expect(
        notificationSubscriptionsRepository.manager.connection.queryResultCache
          ?.remove,
      ).toHaveBeenCalledTimes(mockSubscriptions.length);
    });

    it('Should handle empty subscriptions array', async () => {
      const args = {
        subscriptions: [],
      };

      notificationSubscriptionsRepository.find.mockResolvedValue([]);
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionsRepository,
      );

      const result = notificationsRepository.deleteAllSubscriptions(args);

      await expect(result).rejects.toThrow(
        new NotFoundException('No Subscription Found!'),
      );
      expect(notificationSubscriptionsRepository.find).toHaveBeenCalledWith({
        where: [],
      });
    });

    it('Should include signerAddress in where conditions when provided', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const deleteAllSubscriptionsDto = deleteAllSubscriptionsDtoBuilder()
        .with('subscriptions', [
          {
            chainId: faker.string.numeric(),
            deviceUuid: faker.string.uuid() as UUID,
            safeAddress: getAddress(faker.finance.ethereumAddress()),
            signerAddress,
          },
        ])
        .build().subscriptions;

      const mockSubscriptions = [notificationSubscriptionBuilder().build()];
      notificationSubscriptionsRepository.find.mockResolvedValue(
        mockSubscriptions,
      );
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionsRepository,
      );

      const args = {
        subscriptions: deleteAllSubscriptionsDto,
      };

      await notificationsRepository.deleteAllSubscriptions(args);

      expect(notificationSubscriptionsRepository.find).toHaveBeenCalledWith({
        where: [
          {
            chain_id: deleteAllSubscriptionsDto[0].chainId,
            safe_address: deleteAllSubscriptionsDto[0].safeAddress,
            push_notification_device: {
              device_uuid: deleteAllSubscriptionsDto[0].deviceUuid,
            },
            signer_address: signerAddress,
          },
        ],
      });
    });

    it('Should not include signerAddress in where conditions when not provided', async () => {
      const deleteAllSubscriptionsDto = deleteAllSubscriptionsDtoBuilder()
        .with('subscriptions', [
          {
            chainId: faker.string.numeric(),
            deviceUuid: faker.string.uuid() as UUID,
            safeAddress: getAddress(faker.finance.ethereumAddress()),
          },
        ])
        .build().subscriptions;

      const mockSubscriptions = [notificationSubscriptionBuilder().build()];
      notificationSubscriptionsRepository.find.mockResolvedValue(
        mockSubscriptions,
      );
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionsRepository,
      );

      const args = {
        subscriptions: deleteAllSubscriptionsDto,
      };

      await notificationsRepository.deleteAllSubscriptions(args);

      expect(notificationSubscriptionsRepository.find).toHaveBeenCalledWith({
        where: [
          {
            chain_id: deleteAllSubscriptionsDto[0].chainId,
            safe_address: deleteAllSubscriptionsDto[0].safeAddress,
            push_notification_device: {
              device_uuid: deleteAllSubscriptionsDto[0].deviceUuid,
            },
          },
        ],
      });
    });

    it('Should include signer_address: null in where conditions when signerAddress is explicitly null', async () => {
      const deleteAllSubscriptionsDto = deleteAllSubscriptionsDtoBuilder()
        .with('subscriptions', [
          {
            chainId: faker.string.numeric(),
            deviceUuid: faker.string.uuid() as UUID,
            safeAddress: getAddress(faker.finance.ethereumAddress()),
            signerAddress: null,
          },
        ])
        .build().subscriptions;

      const mockSubscriptions = [notificationSubscriptionBuilder().build()];
      notificationSubscriptionsRepository.find.mockResolvedValue(
        mockSubscriptions,
      );
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionsRepository,
      );

      const args = {
        subscriptions: deleteAllSubscriptionsDto,
      };

      await notificationsRepository.deleteAllSubscriptions(args);

      expect(notificationSubscriptionsRepository.find).toHaveBeenCalledWith({
        where: [
          {
            chain_id: deleteAllSubscriptionsDto[0].chainId,
            safe_address: deleteAllSubscriptionsDto[0].safeAddress,
            push_notification_device: {
              device_uuid: deleteAllSubscriptionsDto[0].deviceUuid,
            },
            signer_address: IsNull(),
          },
        ],
      });
    });

    it('Should handle mixed signerAddress values in single request', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const deleteAllSubscriptionsDto = deleteAllSubscriptionsDtoBuilder()
        .with('subscriptions', [
          {
            chainId: faker.string.numeric(),
            deviceUuid: faker.string.uuid() as UUID,
            safeAddress: getAddress(faker.finance.ethereumAddress()),
            // signerAddress omitted (undefined)
          },
          {
            chainId: faker.string.numeric(),
            deviceUuid: faker.string.uuid() as UUID,
            safeAddress: getAddress(faker.finance.ethereumAddress()),
            signerAddress: null,
          },
          {
            chainId: faker.string.numeric(),
            deviceUuid: faker.string.uuid() as UUID,
            safeAddress: getAddress(faker.finance.ethereumAddress()),
            signerAddress,
          },
        ])
        .build().subscriptions;

      const mockSubscriptions = [notificationSubscriptionBuilder().build()];
      notificationSubscriptionsRepository.find.mockResolvedValue(
        mockSubscriptions,
      );
      mockPostgresDatabaseService.getRepository.mockResolvedValue(
        notificationSubscriptionsRepository,
      );

      const args = {
        subscriptions: deleteAllSubscriptionsDto,
      };

      await notificationsRepository.deleteAllSubscriptions(args);

      expect(notificationSubscriptionsRepository.find).toHaveBeenCalledWith({
        where: [
          {
            chain_id: deleteAllSubscriptionsDto[0].chainId,
            safe_address: deleteAllSubscriptionsDto[0].safeAddress,
            push_notification_device: {
              device_uuid: deleteAllSubscriptionsDto[0].deviceUuid,
            },
            // No signer_address field for undefined
          },
          {
            chain_id: deleteAllSubscriptionsDto[1].chainId,
            safe_address: deleteAllSubscriptionsDto[1].safeAddress,
            push_notification_device: {
              device_uuid: deleteAllSubscriptionsDto[1].deviceUuid,
            },
            signer_address: IsNull(),
          },
          {
            chain_id: deleteAllSubscriptionsDto[2].chainId,
            safe_address: deleteAllSubscriptionsDto[2].safeAddress,
            push_notification_device: {
              device_uuid: deleteAllSubscriptionsDto[2].deviceUuid,
            },
            signer_address: signerAddress,
          },
        ],
      });
    });
  });
});
