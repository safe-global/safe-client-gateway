import type { UUID } from 'crypto';
import type { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker/.';
import type { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { type ILoggingService } from '@/logging/logging.interface';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { NotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository';
import type { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import type { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';
import type { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import { notificationTypeBuilder } from '@/datasources/notifications/entities/__tests__/notification-type.entity.db.builder';
import { notificationSubscriptionBuilder } from '@/datasources/notifications/entities/__tests__/notification-subscription.entity.db.builder';
import type { NotificationSubscription } from '@/datasources/notifications/entities/notification-subscription.entity.db';

describe('NotificationsRepositoryV2', () => {
  let notificationsRepository: INotificationsRepositoryV2;
  let postgresDatabaseService: PostgresDatabaseService;
  const mockLoggingService = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  } as jest.MockedObjectDeep<ILoggingService>;
  const mockPushNotificationsApi: IPushNotificationsApi = {
    enqueueNotification: jest.fn(),
  };
  const mockDataSource = {
    getRepository: jest.fn(),
    isInitialized: false,
    initialize: jest.fn(),
  } as jest.MockedObjectDeep<DataSource>;

  beforeEach(() => {
    postgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      mockDataSource,
    );
    notificationsRepository = new NotificationsRepositoryV2(
      mockPushNotificationsApi,
      mockLoggingService,
      postgresDatabaseService,
    );
  });

  describe('getSafeSubscription()', () => {
    it('Should return a notification type', async () => {
      const mockNotificationTypes = Array.from({ length: 4 }, () =>
        notificationTypeBuilder().build(),
      );
      const notificationTypeRepository = {
        find: jest.fn().mockResolvedValue(mockNotificationTypes),
      } as jest.MockedObjectDeep<Repository<NotificationType>>;
      postgresDatabaseService.getRepository = jest
        .fn()
        .mockResolvedValue(notificationTypeRepository);

      const authPayload = new AuthPayload();
      authPayload.chain_id = faker.number.int({ min: 1, max: 100 }).toString();
      authPayload.signer_address = faker.string.hexadecimal({
        length: 32,
      }) as `0x${string}`;

      const args = {
        authPayload: authPayload,
        deviceUuid: faker.string.uuid() as UUID,
        chainId: authPayload.chain_id,
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
      const authPayload = new AuthPayload();
      authPayload.chain_id = faker.number.int({ min: 1, max: 100 }).toString();
      authPayload.signer_address = '' as `0x${string}`;

      const args = {
        authPayload: authPayload,
        deviceUuid: faker.string.uuid() as UUID,
        chainId: authPayload.chain_id,
        safeAddress: faker.string.hexadecimal({
          length: 32,
        }) as `0x${string}`,
      };
      const result = notificationsRepository.getSafeSubscription(args);

      await expect(result).rejects.toThrow(UnauthorizedException);
    });

    it('Should return an empty array if there is no notification type for safe', async () => {
      const mockNotificationTypes: Array<NotificationType> = [];
      const notificationTypeRepository = {
        find: jest.fn().mockResolvedValue(mockNotificationTypes),
      } as jest.MockedObjectDeep<Repository<NotificationType>>;
      postgresDatabaseService.getRepository = jest
        .fn()
        .mockResolvedValue(notificationTypeRepository);

      const authPayload = new AuthPayload();
      authPayload.chain_id = faker.number.int({ min: 1, max: 100 }).toString();
      authPayload.signer_address = faker.string.hexadecimal({
        length: 32,
      }) as `0x${string}`;

      const args = {
        authPayload: authPayload,
        deviceUuid: faker.string.uuid() as UUID,
        chainId: authPayload.chain_id,
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
    it('Should succesfully return subscribers by safe', async () => {
      const mockSbuscribers = Array.from(
        { length: 5 },
        (): NotificationSubscription =>
          notificationSubscriptionBuilder().build(),
      );
      const notificationSubscriptionsRepository = {
        find: jest.fn().mockResolvedValue(mockSbuscribers),
      } as jest.MockedObjectDeep<Repository<NotificationSubscription>>;
      postgresDatabaseService.getRepository = jest
        .fn()
        .mockResolvedValue(notificationSubscriptionsRepository);

      const result = await notificationsRepository.getSubscribersBySafe({
        chainId: faker.number.int({ min: 1, max: 100 }).toString(),
        safeAddress: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
      });

      const output = mockSbuscribers.map(
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
      const mockSbuscribers: Array<NotificationSubscription> = [];
      const notificationSubscriptionsRepository = {
        find: jest.fn().mockResolvedValue(mockSbuscribers),
      } as jest.MockedObjectDeep<Repository<NotificationSubscription>>;
      postgresDatabaseService.getRepository = jest
        .fn()
        .mockResolvedValue(notificationSubscriptionsRepository);

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

      const notificationSubscriptionRepository = {
        findOne: jest.fn().mockResolvedValue(mockNotificationSubscription),
        remove: jest.fn(),
      } as jest.MockedObjectDeep<Repository<NotificationSubscription>>;
      postgresDatabaseService.getRepository = jest
        .fn()
        .mockResolvedValue(notificationSubscriptionRepository);

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
      const notificationSubscriptionRepository = {
        findOne: jest.fn().mockResolvedValue(null),
        remove: jest.fn(),
      } as jest.MockedObjectDeep<Repository<NotificationSubscription>>;
      postgresDatabaseService.getRepository = jest
        .fn()
        .mockResolvedValue(notificationSubscriptionRepository);

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
      expect(notificationSubscriptionRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('deleteDevice()', () => {
    it('Should delete a device successfully', async () => {
      const notificationDeviceRepository = {
        delete: jest.fn(),
      } as jest.MockedObjectDeep<Repository<NotificationSubscription>>;
      postgresDatabaseService.getRepository = jest
        .fn()
        .mockResolvedValue(notificationDeviceRepository);

      const deviceUuid = faker.string.uuid() as UUID;

      await notificationsRepository.deleteDevice(deviceUuid);

      expect(notificationDeviceRepository.delete).toHaveBeenCalled();
      expect(notificationDeviceRepository.delete).toHaveBeenCalledWith({
        device_uuid: deviceUuid,
      });
    });
  });
});
