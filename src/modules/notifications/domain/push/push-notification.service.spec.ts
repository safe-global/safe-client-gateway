// SPDX-License-Identifier: FSL-1.1-MIT

import type { UUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import type { Job } from 'bullmq';
import type { Address, Hash } from 'viem';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { IDelegatesV2Repository } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { chainUpdateEventBuilder } from '@/modules/hooks/routes/entities/__tests__/chain-update.builder';
import { deletedMultisigTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/deleted-multisig-transaction.builder';
import { executedTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/executed-transaction.builder';
import { incomingEtherEventBuilder } from '@/modules/hooks/routes/entities/__tests__/incoming-ether.builder';
import { incomingTokenEventBuilder } from '@/modules/hooks/routes/entities/__tests__/incoming-token.builder';
import { messageCreatedEventBuilder } from '@/modules/hooks/routes/entities/__tests__/message-created.builder';
import { moduleTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/module-transaction.builder';
import { pendingTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/pending-transaction.builder';
import { messageBuilder } from '@/modules/messages/domain/entities/__tests__/message.builder';
import { messageConfirmationBuilder } from '@/modules/messages/domain/entities/__tests__/message-confirmation.builder';
import type { IMessagesRepository } from '@/modules/messages/domain/messages.repository.interface';
import {
  addr,
  createSubscriber,
} from '@/modules/notifications/domain/push/__tests__/helpers';
import { pushNotificationDeliveryJobDataBuilder } from '@/modules/notifications/domain/push/entities/__tests__/push-notification-delivery-job-data.builder';
import { PushNotificationService } from '@/modules/notifications/domain/push/push-notification.service';
import { NotificationType } from '@/modules/notifications/domain/v2/entities/notification.entity';
import type { INotificationsRepositoryV2 } from '@/modules/notifications/domain/v2/notifications.repository.interface';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import { nativeTokenTransferBuilder } from '@/modules/safe/domain/entities/__tests__/native-token-transfer.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import type { Transfer } from '@/modules/safe/domain/entities/transfer.entity';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

const mockJobQueueService = jest.mocked({
  addJob: jest.fn(),
  getJob: jest.fn(),
} as jest.MockedObjectDeep<IJobQueueService>);

const mockLoggingService = jest.mocked({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const mockSafeRepository = jest.mocked({
  getSafe: jest.fn(),
  getIncomingTransfers: jest.fn(),
  getMultiSigTransaction: jest.fn(),
} as jest.MockedObjectDeep<ISafeRepository>);

const mockDelegatesRepository = jest.mocked({
  getDelegates: jest.fn(),
} as jest.MockedObjectDeep<IDelegatesV2Repository>);

const mockMessagesRepository = jest.mocked({
  getMessageByHash: jest.fn(),
} as jest.MockedObjectDeep<IMessagesRepository>);

const mockNotificationsRepository = jest.mocked({
  enqueueNotification: jest.fn(),
  getSubscribersBySafe: jest.fn(),
} as jest.MockedObjectDeep<INotificationsRepositoryV2>);

function createSafe(
  overrides?: Partial<{ owners: Array<Address>; threshold: number }>,
): Safe {
  let builder = safeBuilder();
  if (overrides?.owners) {
    builder = builder.with('owners', overrides.owners);
  }
  if (overrides?.threshold !== undefined) {
    builder = builder.with('threshold', overrides.threshold);
  }
  return builder.build();
}

describe('PushNotificationService (Unit)', () => {
  let service: PushNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new PushNotificationService(
      mockJobQueueService,
      mockLoggingService,
      mockSafeRepository,
      mockDelegatesRepository,
      mockMessagesRepository,
      mockNotificationsRepository,
    );
  });

  describe('enqueueEvent', () => {
    it('should call addJob with PUSH_NOTIFICATION_EVENT and the event', async () => {
      const event = incomingTokenEventBuilder().build();
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.enqueueEvent(event);

      expect(mockJobQueueService.addJob).toHaveBeenCalledWith(
        JobType.PUSH_NOTIFICATION_EVENT,
        { event },
      );
    });

    it('should swallow addJob errors and log', async () => {
      const event = incomingTokenEventBuilder().build();
      mockJobQueueService.addJob.mockRejectedValue(
        new Error('Redis unavailable'),
      );

      await expect(service.enqueueEvent(event)).resolves.not.toThrow();

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to enqueue push notification event'),
      );
    });
  });

  // ── processEvent: Event Filtering ──

  describe('processEvent - event filtering (allowlist)', () => {
    const notifiableBuilders = [
      { name: 'INCOMING_TOKEN', builder: incomingTokenEventBuilder },
      { name: 'INCOMING_ETHER', builder: incomingEtherEventBuilder },
      {
        name: 'PENDING_MULTISIG_TRANSACTION',
        builder: pendingTransactionEventBuilder,
      },
      { name: 'MESSAGE_CREATED', builder: messageCreatedEventBuilder },
      {
        name: 'EXECUTED_MULTISIG_TRANSACTION',
        builder: executedTransactionEventBuilder,
      },
      {
        name: 'DELETED_MULTISIG_TRANSACTION',
        builder: deletedMultisigTransactionEventBuilder,
      },
      { name: 'MODULE_TRANSACTION', builder: moduleTransactionEventBuilder },
    ];

    it.each(notifiableBuilders)(
      'should process $name events (notifiable)',
      async ({ builder }) => {
        const event = builder().build();
        mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([]);
        // For owner-only events, provide a Safe
        mockSafeRepository.getSafe.mockResolvedValue(createSafe());

        const result = await service.processEvent(event);

        // With 0 subscribers, should return 0 delivery jobs
        expect(result).toBe(0);
        expect(
          mockNotificationsRepository.getSubscribersBySafe,
        ).toHaveBeenCalled();
      },
    );

    it('should skip non-notifiable events (CHAIN_UPDATE)', async () => {
      const event = chainUpdateEventBuilder().build();

      const result = await service.processEvent(event);

      expect(result).toBe(0);
      expect(
        mockNotificationsRepository.getSubscribersBySafe,
      ).not.toHaveBeenCalled();
    });
  });

  // ── processEvent: Subscriber Resolution ──

  describe('processEvent - subscriber resolution', () => {
    it('should return all subscribers for non-owner-only events (INCOMING_TOKEN)', async () => {
      const event = incomingTokenEventBuilder().build();
      const sub1 = createSubscriber();
      const sub2 = createSubscriber();
      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([
        sub1,
        sub2,
      ]);
      mockSafeRepository.getIncomingTransfers.mockResolvedValue(
        pageBuilder<Transfer>()
          .with('results', [
            nativeTokenTransferBuilder()
              .with('transactionHash', event.txHash as Hash)
              .with('from', addr())
              .build(),
          ])
          .build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      const result = await service.processEvent(event);

      // Both subscribers get delivery jobs (no filtering for non-owner events)
      expect(result).toBe(2);
      expect(mockJobQueueService.addJob).toHaveBeenCalledTimes(2);
    });

    it('should filter to owners/delegates for PENDING_MULTISIG_TRANSACTION', async () => {
      const ownerAddress = addr();
      const nonOwnerAddress = addr();
      const event = pendingTransactionEventBuilder().build();
      const ownerSub = {
        ...createSubscriber(),
        subscriber: ownerAddress,
      };
      const nonOwnerSub = {
        ...createSubscriber(),
        subscriber: nonOwnerAddress,
      };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([
        ownerSub,
        nonOwnerSub,
      ]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>().with('results', []).build(),
      );
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(
        multisigTransactionBuilder().with('confirmations', []).build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      const result = await service.processEvent(event);

      // Only owner gets a delivery job (non-owner filtered out)
      expect(result).toBe(1);
    });

    it('should handle empty subscriber list', async () => {
      const event = incomingTokenEventBuilder().build();
      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([]);

      const result = await service.processEvent(event);

      expect(result).toBe(0);
      expect(mockJobQueueService.addJob).not.toHaveBeenCalled();
    });
  });

  // ── processEvent: Notification Mapping ──

  describe('processEvent - notification mapping', () => {
    it.each([
      ['INCOMING_TOKEN', incomingTokenEventBuilder],
      ['INCOMING_ETHER', incomingEtherEventBuilder],
    ])(
      'should suppress %s self-send (from === address)',
      async (_type, builderFn) => {
        const event = builderFn().build();
        const sub = createSubscriber();

        mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([
          sub,
        ]);
        mockSafeRepository.getIncomingTransfers.mockResolvedValue(
          pageBuilder<Transfer>()
            .with('results', [
              nativeTokenTransferBuilder()
                .with('transactionHash', event.txHash as Hash)
                .with('from', event.address)
                .build(),
            ])
            .build(),
        );

        const result = await service.processEvent(event);

        expect(result).toBe(0);
        expect(mockJobQueueService.addJob).not.toHaveBeenCalled();
      },
    );

    it('should create ConfirmationRequest for pending TX with threshold > 1 and unsigned subscriber', async () => {
      const ownerAddress = addr();
      const event = pendingTransactionEventBuilder().build();
      const sub = { ...createSubscriber(), subscriber: ownerAddress };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>().with('results', []).build(),
      );
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(
        multisigTransactionBuilder().with('confirmations', []).build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.processEvent(event);

      expect(mockJobQueueService.addJob).toHaveBeenCalledWith(
        JobType.PUSH_NOTIFICATION_DELIVERY,
        expect.objectContaining({
          token: sub.cloudMessagingToken,
          deviceUuid: sub.deviceUuid,
          chainId: event.chainId,
          safeAddress: event.address,
          notificationType: NotificationType.CONFIRMATION_REQUEST,
          notification: {
            data: {
              type: NotificationType.CONFIRMATION_REQUEST,
              to: event.to,
              chainId: event.chainId,
              address: event.address,
              safeTxHash: event.safeTxHash,
            },
          },
        }),
      );
    });

    it('should suppress pending TX notification for threshold=1 Safe', async () => {
      const ownerAddress = addr();
      const event = pendingTransactionEventBuilder().build();
      const sub = { ...createSubscriber(), subscriber: ownerAddress };
      const safe = createSafe({ owners: [ownerAddress], threshold: 1 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>().with('results', []).build(),
      );

      const result = await service.processEvent(event);

      expect(result).toBe(0);
      expect(mockJobQueueService.addJob).not.toHaveBeenCalled();
      expect(mockSafeRepository.getMultiSigTransaction).not.toHaveBeenCalled();
    });

    it('should suppress pending TX if subscriber already signed', async () => {
      const ownerAddress = addr();
      const event = pendingTransactionEventBuilder().build();
      const sub = { ...createSubscriber(), subscriber: ownerAddress };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(
        multisigTransactionBuilder()
          .with('confirmations', [
            confirmationBuilder().with('owner', ownerAddress).build(),
          ])
          .build(),
      );

      const result = await service.processEvent(event);

      expect(result).toBe(0);
    });

    it('should create MessageConfirmationRequest for message with threshold > 1', async () => {
      const ownerAddress = addr();
      const event = messageCreatedEventBuilder().build();
      const sub = { ...createSubscriber(), subscriber: ownerAddress };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>().with('results', []).build(),
      );
      mockMessagesRepository.getMessageByHash.mockResolvedValue(
        messageBuilder().with('confirmations', []).build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.processEvent(event);

      expect(mockJobQueueService.addJob).toHaveBeenCalledWith(
        JobType.PUSH_NOTIFICATION_DELIVERY,
        expect.objectContaining({
          notificationType: NotificationType.MESSAGE_CONFIRMATION_REQUEST,
        }),
      );
    });

    it('should pass through executed/deleted/module events as-is', async () => {
      const event = executedTransactionEventBuilder().build();
      const sub = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      const result = await service.processEvent(event);

      expect(result).toBe(1);
      expect(mockJobQueueService.addJob).toHaveBeenCalledWith(
        JobType.PUSH_NOTIFICATION_DELIVERY,
        expect.objectContaining({
          notificationType: event.type,
        }),
      );
    });
  });

  // ── processEvent: Delivery resilience ──

  describe('processEvent - delivery resilience', () => {
    it('should continue enqueuing after one addJob failure', async () => {
      const event = incomingTokenEventBuilder().build();
      const sub1 = createSubscriber();
      const sub2 = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([
        sub1,
        sub2,
      ]);
      mockSafeRepository.getIncomingTransfers.mockResolvedValue(
        pageBuilder<Transfer>()
          .with('results', [
            nativeTokenTransferBuilder()
              .with('transactionHash', event.txHash as Hash)
              .with('from', addr())
              .build(),
          ])
          .build(),
      );
      mockJobQueueService.addJob
        .mockRejectedValueOnce(new Error('Redis down'))
        .mockResolvedValueOnce({} as Job);

      const result = await service.processEvent(event);

      // One succeeded, one failed — only count the successful one
      expect(result).toBe(1);
      expect(mockJobQueueService.addJob).toHaveBeenCalledTimes(2);
    });
  });

  // ── processEvent: getSafe() optimization ──

  describe('processEvent - getSafe() N+1 elimination', () => {
    it('should call getSafe exactly once for PENDING_MULTISIG_TRANSACTION with multiple subscribers', async () => {
      const owner1 = addr();
      const owner2 = addr();
      const event = pendingTransactionEventBuilder().build();
      const sub1 = { ...createSubscriber(), subscriber: owner1 };
      const sub2 = { ...createSubscriber(), subscriber: owner2 };
      const safe = createSafe({
        owners: [owner1, owner2],
        threshold: 2,
      });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([
        sub1,
        sub2,
      ]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>().with('results', []).build(),
      );
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(
        multisigTransactionBuilder().with('confirmations', []).build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.processEvent(event);

      // Exactly 1 getSafe call, not 2M (where M = subscribers)
      expect(mockSafeRepository.getSafe).toHaveBeenCalledTimes(1);
      // Owner subscribers skip getDelegates entirely (early return in resolveSubscriberDelegates)
      expect(mockDelegatesRepository.getDelegates).not.toHaveBeenCalled();
    });

    it('should call getDelegates exactly once per delegate subscriber', async () => {
      const delegate1 = addr();
      const delegate2 = addr();
      const ownerAddress = addr();
      const event = pendingTransactionEventBuilder().build();
      const sub1 = { ...createSubscriber(), subscriber: delegate1 };
      const sub2 = { ...createSubscriber(), subscriber: delegate2 };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([
        sub1,
        sub2,
      ]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>()
          .with('results', [
            delegateBuilder().with('delegator', ownerAddress).build(),
          ])
          .build(),
      );
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(
        multisigTransactionBuilder().with('confirmations', []).build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.processEvent(event);

      // Exactly 1 getDelegates call per subscriber
      expect(mockDelegatesRepository.getDelegates).toHaveBeenCalledTimes(2);
    });

    it('should not call getSafe for non-owner-only events (INCOMING_TOKEN)', async () => {
      const event = incomingTokenEventBuilder().build();
      const sub = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getIncomingTransfers.mockResolvedValue(
        pageBuilder<Transfer>()
          .with('results', [
            nativeTokenTransferBuilder()
              .with('transactionHash', event.txHash as Hash)
              .with('from', addr())
              .build(),
          ])
          .build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.processEvent(event);

      expect(mockSafeRepository.getSafe).not.toHaveBeenCalled();
    });
  });

  // ── processEvent: Logging ──

  describe('processEvent - logging on silent errors', () => {
    it('should log warning and suppress notification when getIncomingTransfers fails', async () => {
      const event = incomingTokenEventBuilder().build();
      const sub = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getIncomingTransfers.mockRejectedValue(
        new Error('Service unavailable'),
      );

      // Should not throw — error is caught and logged
      const result = await service.processEvent(event);

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch incoming transfers'),
      );
      // Suppressed — no delivery job created when transfer lookup fails
      expect(result).toBe(0);
      expect(mockJobQueueService.addJob).not.toHaveBeenCalled();
    });
  });

  // ── processEvent: Structured Logging ──

  describe('processEvent - structured logging', () => {
    it('should log NotificationDeliveryQueued for each delivery job created', async () => {
      const event = incomingTokenEventBuilder().build();
      const sub1 = createSubscriber();
      const sub2 = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([
        sub1,
        sub2,
      ]);
      mockSafeRepository.getIncomingTransfers.mockResolvedValue(
        pageBuilder<Transfer>()
          .with('results', [
            nativeTokenTransferBuilder()
              .with('transactionHash', event.txHash as Hash)
              .with('from', addr())
              .build(),
          ])
          .build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.processEvent(event);

      const deliveryQueuedCalls = mockLoggingService.info.mock.calls.filter(
        (call) =>
          (call[0] as Record<string, unknown>).type ===
          LogType.NotificationDeliveryQueued,
      );
      expect(deliveryQueuedCalls).toHaveLength(2);
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.NotificationDeliveryQueued,
          chainId: event.chainId,
          safeAddress: event.address,
        }),
      );
    });

    it('should log NotificationEventProcessed after event processing completes', async () => {
      const event = incomingTokenEventBuilder().build();
      const sub = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getIncomingTransfers.mockResolvedValue(
        pageBuilder<Transfer>()
          .with('results', [
            nativeTokenTransferBuilder()
              .with('transactionHash', event.txHash as Hash)
              .with('from', addr())
              .build(),
          ])
          .build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.processEvent(event);

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.NotificationEventProcessed,
          eventType: event.type,
          chainId: event.chainId,
          address: event.address,
          deliveryJobCount: 1,
        }),
      );
    });

    it('should log NotificationEventProcessed with deliveryJobCount 0 for skipped events', async () => {
      const event = incomingTokenEventBuilder().build();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([]);

      await service.processEvent(event);

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.NotificationEventProcessed,
          deliveryJobCount: 0,
        }),
      );
    });
  });

  // ── processDelivery ──

  describe('processDelivery', () => {
    it('should call enqueueNotification and return delivered: true', async () => {
      const data = pushNotificationDeliveryJobDataBuilder().build();
      mockNotificationsRepository.enqueueNotification.mockResolvedValue();

      const result = await service.processDelivery(data);

      expect(
        mockNotificationsRepository.enqueueNotification,
      ).toHaveBeenCalledWith({
        token: data.token,
        deviceUuid: data.deviceUuid,
        notification: data.notification,
      });
      expect(result).toEqual({ delivered: true });
    });

    it('should log structured delivery info on success', async () => {
      const data = pushNotificationDeliveryJobDataBuilder().build();
      mockNotificationsRepository.enqueueNotification.mockResolvedValue();

      await service.processDelivery(data);

      expect(mockLoggingService.info).toHaveBeenCalledWith({
        type: LogType.NotificationSent,
        chainId: data.chainId,
        safeAddress: data.safeAddress,
        notificationType: data.notificationType,
        deviceUuid: data.deviceUuid,
      });
    });

    it('should propagate transient errors for BullMQ retry', async () => {
      const data = pushNotificationDeliveryJobDataBuilder().build();
      const error = new Error('FCM 503');
      mockNotificationsRepository.enqueueNotification.mockRejectedValue(error);

      await expect(service.processDelivery(data)).rejects.toThrow(error);
    });
  });

  // ── T1: Delegate-is-owner scenario ──

  describe('processEvent - delegate resolution', () => {
    it('should include delegates whose delegator is a Safe owner', async () => {
      const delegateAddress = addr();
      const ownerAddress = addr();
      const event = pendingTransactionEventBuilder().build();
      const sub = { ...createSubscriber(), subscriber: delegateAddress };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>()
          .with('results', [
            delegateBuilder().with('delegator', ownerAddress).build(),
          ])
          .build(),
      );
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(
        multisigTransactionBuilder().with('confirmations', []).build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      const result = await service.processEvent(event);

      expect(result).toBe(1);
    });

    // ── T2: Null subscriber filtered out in owner-delegate events ──

    it('should filter out subscriptions with null subscriber for owner-only events', async () => {
      const ownerAddress = addr();
      const event = pendingTransactionEventBuilder().build();
      const nullSub = {
        subscriber: null as Address | null,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(32),
      };
      const ownerSub = { ...createSubscriber(), subscriber: ownerAddress };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([
        nullSub,
        ownerSub,
      ]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>().with('results', []).build(),
      );
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(
        multisigTransactionBuilder().with('confirmations', []).build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      const result = await service.processEvent(event);

      // Only ownerSub should produce a delivery job; nullSub is filtered
      expect(result).toBe(1);
    });
  });

  // ── T3: Deduplication by cloudMessagingToken ──

  describe('processEvent - deduplication', () => {
    it('should deduplicate subscribers by cloudMessagingToken', async () => {
      const event = incomingTokenEventBuilder().build();
      const sharedToken = faker.string.alphanumeric(32);
      const sub1 = { ...createSubscriber(), cloudMessagingToken: sharedToken };
      const sub2 = { ...createSubscriber(), cloudMessagingToken: sharedToken };

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([
        sub1,
        sub2,
      ]);
      mockSafeRepository.getIncomingTransfers.mockResolvedValue(
        pageBuilder<Transfer>()
          .with('results', [
            nativeTokenTransferBuilder()
              .with('transactionHash', event.txHash as Hash)
              .with('from', addr())
              .build(),
          ])
          .build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      const result = await service.processEvent(event);

      // Only 1 delivery job despite 2 subscriptions with same token
      expect(result).toBe(1);
      expect(mockJobQueueService.addJob).toHaveBeenCalledTimes(1);
    });
  });

  // ── T4: hasSubscriberSigned via delegator ──

  describe('processEvent - signed suppression via delegator', () => {
    it('should suppress notification when subscriber delegator already signed (PENDING)', async () => {
      const delegateAddress = addr();
      const ownerAddress = addr();
      const event = pendingTransactionEventBuilder().build();
      const sub = { ...createSubscriber(), subscriber: delegateAddress };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>()
          .with('results', [
            delegateBuilder().with('delegator', ownerAddress).build(),
          ])
          .build(),
      );
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(
        multisigTransactionBuilder()
          .with('confirmations', [
            confirmationBuilder().with('owner', ownerAddress).build(),
          ])
          .build(),
      );

      const result = await service.processEvent(event);

      expect(result).toBe(0);
      expect(mockJobQueueService.addJob).not.toHaveBeenCalled();
    });

    it('should suppress notification when subscriber delegator already signed (MESSAGE)', async () => {
      const delegateAddress = addr();
      const ownerAddress = addr();
      const event = messageCreatedEventBuilder().build();
      const sub = { ...createSubscriber(), subscriber: delegateAddress };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>()
          .with('results', [
            delegateBuilder().with('delegator', ownerAddress).build(),
          ])
          .build(),
      );
      mockMessagesRepository.getMessageByHash.mockResolvedValue(
        messageBuilder()
          .with('confirmations', [
            messageConfirmationBuilder().with('owner', ownerAddress).build(),
          ])
          .build(),
      );

      const result = await service.processEvent(event);

      expect(result).toBe(0);
      expect(mockJobQueueService.addJob).not.toHaveBeenCalled();
    });
  });

  // ── T5: Empty incoming transfers results array ──

  describe('processEvent - incoming transfers edge cases', () => {
    it('should send notification when getIncomingTransfers returns empty results', async () => {
      const event = incomingTokenEventBuilder().build();
      const sub = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getIncomingTransfers.mockResolvedValue(
        pageBuilder<Transfer>().with('results', []).build(),
      );
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      const result = await service.processEvent(event);

      // No matching transfer found → not self-send → notify
      expect(result).toBe(1);
      expect(mockJobQueueService.addJob).toHaveBeenCalledTimes(1);
    });
  });

  // ── T6: Null confirmations on transaction/message ──

  describe('processEvent - null confirmations', () => {
    it('should suppress notification when transaction has null confirmations', async () => {
      const ownerAddress = addr();
      const event = pendingTransactionEventBuilder().build();
      const sub = { ...createSubscriber(), subscriber: ownerAddress };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>().with('results', []).build(),
      );
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(
        multisigTransactionBuilder().with('confirmations', null).build(),
      );

      const result = await service.processEvent(event);

      expect(result).toBe(0);
      expect(mockJobQueueService.addJob).not.toHaveBeenCalled();
    });

    it('should suppress notification when message has null confirmations', async () => {
      const ownerAddress = addr();
      const event = messageCreatedEventBuilder().build();
      const sub = { ...createSubscriber(), subscriber: ownerAddress };
      const safe = createSafe({ owners: [ownerAddress], threshold: 2 });

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>().with('results', []).build(),
      );

      const message = messageBuilder().build();
      // @ts-expect-error - testing runtime guard when confirmations is absent
      message.confirmations = undefined;
      mockMessagesRepository.getMessageByHash.mockResolvedValue(message);

      const result = await service.processEvent(event);

      expect(result).toBe(0);
      expect(mockJobQueueService.addJob).not.toHaveBeenCalled();
    });
  });

  // ── T7: DELETED and MODULE event pass-through ──

  describe('processEvent - pass-through events', () => {
    it('should map EXECUTED_MULTISIG_TRANSACTION to explicit notification fields', async () => {
      const event = executedTransactionEventBuilder().build();
      const sub = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.processEvent(event);

      expect(mockJobQueueService.addJob).toHaveBeenCalledWith(
        JobType.PUSH_NOTIFICATION_DELIVERY,
        expect.objectContaining({
          notification: {
            data: {
              type: event.type,
              chainId: event.chainId,
              address: event.address,
              to: event.to,
              safeTxHash: event.safeTxHash,
              txHash: event.txHash,
              failed: event.failed,
              data: event.data,
            },
          },
        }),
      );
    });

    it('should map DELETED_MULTISIG_TRANSACTION to explicit notification fields', async () => {
      const event = deletedMultisigTransactionEventBuilder().build();
      const sub = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.processEvent(event);

      expect(mockJobQueueService.addJob).toHaveBeenCalledWith(
        JobType.PUSH_NOTIFICATION_DELIVERY,
        expect.objectContaining({
          notification: {
            data: {
              type: event.type,
              chainId: event.chainId,
              address: event.address,
              safeTxHash: event.safeTxHash,
            },
          },
        }),
      );
    });

    it('should map MODULE_TRANSACTION to explicit notification fields', async () => {
      const event = moduleTransactionEventBuilder().build();
      const sub = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe.mockResolvedValue([sub]);
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      await service.processEvent(event);

      expect(mockJobQueueService.addJob).toHaveBeenCalledWith(
        JobType.PUSH_NOTIFICATION_DELIVERY,
        expect.objectContaining({
          notification: {
            data: {
              type: event.type,
              chainId: event.chainId,
              address: event.address,
              module: event.module,
              txHash: event.txHash,
            },
          },
        }),
      );
    });
  });

  describe('processEvent - subscriber lookup failure', () => {
    it('should propagate error when getSubscribersBySafe throws', async () => {
      const event = executedTransactionEventBuilder().build();
      const error = new Error('Database connection lost');
      mockNotificationsRepository.getSubscribersBySafe.mockRejectedValue(error);

      await expect(service.processEvent(event)).rejects.toThrow(error);

      expect(mockJobQueueService.addJob).not.toHaveBeenCalled();
    });
  });

  describe('processEvent - concurrent execution', () => {
    it('should handle concurrent processEvent calls for the same Safe without interference', async () => {
      const sharedAddress = addr();
      const sharedChainId = faker.string.numeric();

      const event1 = executedTransactionEventBuilder()
        .with('address', sharedAddress)
        .with('chainId', sharedChainId)
        .build();
      const event2 = deletedMultisigTransactionEventBuilder()
        .with('address', sharedAddress)
        .with('chainId', sharedChainId)
        .build();

      const sub1 = createSubscriber();
      const sub2 = createSubscriber();

      mockNotificationsRepository.getSubscribersBySafe
        .mockResolvedValueOnce([sub1])
        .mockResolvedValueOnce([sub2]);
      mockJobQueueService.addJob.mockResolvedValue({} as Job);

      const [result1, result2] = await Promise.all([
        service.processEvent(event1),
        service.processEvent(event2),
      ]);

      expect(result1).toBe(1);
      expect(result2).toBe(1);
      expect(mockJobQueueService.addJob).toHaveBeenCalledTimes(2);

      const calls = mockJobQueueService.addJob.mock.calls;
      const types = calls.map(
        (call) => (call[1] as { notificationType: string }).notificationType,
      );
      expect(types).toContain(event1.type);
      expect(types).toContain(event2.type);
    });
  });
});
