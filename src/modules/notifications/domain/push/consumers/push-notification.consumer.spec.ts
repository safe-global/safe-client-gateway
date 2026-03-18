// SPDX-License-Identifier: FSL-1.1-MIT
import type { ILoggingService } from '@/logging/logging.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { PushNotificationConsumer } from '@/modules/notifications/domain/push/consumers/push-notification.consumer';
import type { PushNotificationService } from '@/modules/notifications/domain/push/push-notification.service';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { pushNotificationEventJobDataBuilder } from '@/modules/notifications/domain/push/entities/__tests__/push-notification-event-job-data.builder';
import { pushNotificationDeliveryJobDataBuilder } from '@/modules/notifications/domain/push/entities/__tests__/push-notification-delivery-job-data.builder';
import { faker } from '@faker-js/faker';
import type { Job } from 'bullmq';

const mockLoggingService = jest.mocked({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const pushNotificationService = {
  enqueueEvent: jest.fn(),
  processEvent: jest.fn(),
  processDelivery: jest.fn(),
} as jest.MockedObjectDeep<PushNotificationService>;
const mockPushNotificationService = jest.mocked(pushNotificationService);

function createMockJob<T>(
  name: string,
  data: T,
  overrides?: Partial<Job>,
): Job<T> {
  return {
    id: faker.string.uuid(),
    name,
    data,
    attemptsMade: 0,
    ...overrides,
  } as unknown as Job<T>;
}

describe('PushNotificationConsumer', () => {
  let consumer: PushNotificationConsumer;

  beforeEach(() => {
    jest.clearAllMocks();

    consumer = new PushNotificationConsumer(
      mockLoggingService,
      mockPushNotificationService,
    );
  });

  describe('process()', () => {
    it('should dispatch PUSH_NOTIFICATION_EVENT to service.processEvent', async () => {
      const eventJobData = pushNotificationEventJobDataBuilder().build();
      const job = createMockJob(JobType.PUSH_NOTIFICATION_EVENT, eventJobData);

      mockPushNotificationService.processEvent.mockResolvedValue(0);

      await consumer.process(job);

      expect(mockPushNotificationService.processEvent).toHaveBeenCalledWith(
        eventJobData.event,
      );
    });

    it('should dispatch PUSH_NOTIFICATION_DELIVERY to service.processDelivery', async () => {
      const deliveryData = pushNotificationDeliveryJobDataBuilder().build();
      const job = createMockJob(
        JobType.PUSH_NOTIFICATION_DELIVERY,
        deliveryData,
      );

      mockPushNotificationService.processDelivery.mockResolvedValue({
        delivered: true,
      });

      const result = await consumer.process(job);

      expect(mockPushNotificationService.processDelivery).toHaveBeenCalledWith(
        deliveryData,
      );
      expect(result).toEqual({ delivered: true });
    });

    it('should throw on unknown job type', async () => {
      const job = createMockJob('unknown-job-type', {} as never);

      await expect(consumer.process(job)).rejects.toThrow(
        'Unknown job type: unknown-job-type',
      );
    });

    it('should return delivery job count from processEvent', async () => {
      const eventJobData = pushNotificationEventJobDataBuilder().build();
      const job = createMockJob(JobType.PUSH_NOTIFICATION_EVENT, eventJobData);
      const deliveryCount = 3;

      mockPushNotificationService.processEvent.mockResolvedValue(deliveryCount);

      const result = await consumer.process(job);

      expect(result).toBe(deliveryCount);
    });
  });

  describe('lifecycle event handlers', () => {
    it('onCompleted should log with JobEvent type and enriched fields for delivery jobs', () => {
      const deliveryData = pushNotificationDeliveryJobDataBuilder().build();
      const job = createMockJob(
        JobType.PUSH_NOTIFICATION_DELIVERY,
        deliveryData,
        { attemptsMade: 1 },
      );

      consumer.onCompleted(job);

      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.JobEvent,
          source: 'PushNotificationConsumer',
          jobName: JobType.PUSH_NOTIFICATION_DELIVERY,
          attemptsMade: 1,
          chainId: deliveryData.chainId,
          safeAddress: deliveryData.safeAddress,
          notificationType: deliveryData.notificationType,
          deviceUuid: deliveryData.deviceUuid,
        }),
      );
    });

    it('onCompleted should log with JobEvent type and no enriched fields for event jobs', () => {
      const eventJobData = pushNotificationEventJobDataBuilder().build();
      const job = createMockJob(JobType.PUSH_NOTIFICATION_EVENT, eventJobData, {
        attemptsMade: 0,
      });

      consumer.onCompleted(job);

      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.JobEvent,
          source: 'PushNotificationConsumer',
          jobName: JobType.PUSH_NOTIFICATION_EVENT,
          attemptsMade: 0,
        }),
      );
      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        expect.not.objectContaining({
          chainId: expect.anything(),
          safeAddress: expect.anything(),
          notificationType: expect.anything(),
          deviceUuid: expect.anything(),
        }),
      );
    });

    it('onFailed should log with NotificationError type and enriched fields for delivery jobs', () => {
      const deliveryData = pushNotificationDeliveryJobDataBuilder().build();
      const job = createMockJob(
        JobType.PUSH_NOTIFICATION_DELIVERY,
        deliveryData,
        { attemptsMade: 3 },
      );
      const error = new Error('FCM service unavailable');

      consumer.onFailed(job, error);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.NotificationError,
          source: 'PushNotificationConsumer',
          jobName: JobType.PUSH_NOTIFICATION_DELIVERY,
          attemptsMade: 3,
          chainId: deliveryData.chainId,
          safeAddress: deliveryData.safeAddress,
          notificationType: deliveryData.notificationType,
          deviceUuid: deliveryData.deviceUuid,
        }),
      );
    });

    it('onFailed should log with JobError type and no enriched fields for event jobs', () => {
      const eventJobData = pushNotificationEventJobDataBuilder().build();
      const job = createMockJob(JobType.PUSH_NOTIFICATION_EVENT, eventJobData, {
        attemptsMade: 2,
      });
      const error = new Error('Event processing failed');

      consumer.onFailed(job, error);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.JobError,
          source: 'PushNotificationConsumer',
          jobName: JobType.PUSH_NOTIFICATION_EVENT,
          attemptsMade: 2,
          event: expect.stringContaining('Event processing failed'),
        }),
      );
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.not.objectContaining({
          chainId: expect.anything(),
          safeAddress: expect.anything(),
          notificationType: expect.anything(),
          deviceUuid: expect.anything(),
          token: expect.anything(),
        }),
      );
    });

    it('onWorkerError should log worker-level errors', () => {
      const error = new Error('Redis connection lost');

      consumer.onWorkerError(error);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'PushNotificationConsumer',
          event: expect.stringContaining('Redis connection lost'),
        }),
      );
    });
  });
});
