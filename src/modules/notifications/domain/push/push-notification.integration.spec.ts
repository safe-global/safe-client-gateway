// SPDX-License-Identifier: FSL-1.1-MIT
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { INotificationsRepositoryV2 } from '@/modules/notifications/domain/v2/notifications.repository.interface';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { PushNotificationsApiModule } from '@/datasources/push-notifications-api/push-notifications-api.module';
import { TestPushNotificationsApiModule } from '@/datasources/push-notifications-api/__tests__/test.push-notifications-api.module';
import { PushNotificationModule } from '@/modules/notifications/domain/push/push-notification.module';
import { PushNotificationConsumer } from '@/modules/notifications/domain/push/consumers/push-notification.consumer';
import { IPushNotificationService } from '@/modules/notifications/domain/push/push-notification.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { createTestModule } from '@/__tests__/testing-module';
import { retry } from '@/__tests__/util/retry';
import { executedTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/executed-transaction.builder';
import { deletedMultisigTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/deleted-multisig-transaction.builder';
import { moduleTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/module-transaction.builder';
import { incomingEtherEventBuilder } from '@/modules/hooks/routes/entities/__tests__/incoming-ether.builder';
import { incomingTokenEventBuilder } from '@/modules/hooks/routes/entities/__tests__/incoming-token.builder';
import { chainUpdateEventBuilder } from '@/modules/hooks/routes/entities/__tests__/chain-update.builder';
import { messageCreatedEventBuilder } from '@/modules/hooks/routes/entities/__tests__/message-created.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { nativeTokenTransferBuilder } from '@/modules/safe/domain/entities/__tests__/native-token-transfer.builder';
import { erc20TransferBuilder } from '@/modules/safe/domain/entities/__tests__/erc20-transfer.builder';
import { pendingTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/pending-transaction.builder';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import { messageBuilder } from '@/modules/messages/domain/entities/__tests__/message.builder';
import { messageConfirmationBuilder } from '@/modules/messages/domain/entities/__tests__/message-confirmation.builder';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import type { IncomingEtherEvent } from '@/modules/hooks/routes/entities/schemas/incoming-ether.schema';
import type { IncomingTokenEvent } from '@/modules/hooks/routes/entities/schemas/incoming-token.schema';
import type {
  NativeTokenTransfer,
  ERC20Transfer,
} from '@/modules/safe/domain/entities/transfer.entity';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import type { Address, Hash } from 'viem';
import { getQueueToken } from '@nestjs/bullmq';
import { PUSH_NOTIFICATION_QUEUE } from '@/domain/common/jobs.constants';
import type { Queue } from 'bullmq';
import configuration from '@/config/entities/__tests__/configuration';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import {
  addr,
  createSubscribers,
} from '@/modules/notifications/domain/push/__tests__/helpers';

type IncomingAssetFactory = (safeAddress: Address) => {
  event: IncomingEtherEvent | IncomingTokenEvent;
  transfer: NativeTokenTransfer | ERC20Transfer;
};

/**
 * Test configuration with deterministic queue settings for integration tests.
 * Overrides randomized faker values with predictable settings:
 * - attempts: 3 — enables the transient retry test scenario
 * - backoff.delay: 100ms — fast retries for test speed
 * - concurrency: 5 — matches production default
 */
function integrationConfiguration(): ReturnType<typeof configuration> {
  const config = configuration();
  return {
    ...config,
    pushNotifications: {
      ...config.pushNotifications,
      queue: {
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 43200, count: 500 },
        backoff: { type: 'exponential' as const, delay: 100 },
        attempts: 3,
        concurrency: 5,
      },
    },
  };
}

describe('Push notification queue integration', () => {
  let app: INestApplication<Server>;
  let pushNotificationService: jest.MockedObjectDeep<IPushNotificationService>;
  let notificationsRepository: jest.MockedObjectDeep<INotificationsRepositoryV2>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let configurationService: IConfigurationService;
  let cacheService: FakeCacheService;
  let safeConfigUrl: string;
  let queue: Queue;
  let consumer: PushNotificationConsumer;
  let transactionApiManager: ITransactionApiManager;
  let currentChainId = '';

  beforeAll(async () => {
    const moduleFixture = await createTestModule({
      config: integrationConfiguration,
      modules: [
        // Re-override PushNotificationModule back to real (undo default mock)
        // to keep BullMQ + Redis real for integration testing
        {
          originalModule: PushNotificationModule,
          testModule: PushNotificationModule,
        },
        // Mock NotificationsRepositoryV2 for subscriber and delivery assertions
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
        // Mock PushNotificationsApi (FCM HTTP layer)
        {
          originalModule: PushNotificationsApiModule,
          testModule: TestPushNotificationsApiModule,
        },
      ],
    });

    app = moduleFixture.createNestApplication();

    pushNotificationService = moduleFixture.get(IPushNotificationService);
    notificationsRepository = moduleFixture.get(INotificationsRepositoryV2);
    networkService = moduleFixture.get(NetworkService);
    configurationService = moduleFixture.get(IConfigurationService);
    cacheService = moduleFixture.get(CacheService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    queue = moduleFixture.get(getQueueToken(PUSH_NOTIFICATION_QUEUE));
    consumer = moduleFixture.get(PushNotificationConsumer);
    transactionApiManager = moduleFixture.get(ITransactionApiManager);

    await app.init();
  });

  afterEach(async () => {
    // Server-side pause prevents the worker from dequeuing new jobs.
    // Worker-side pause waits for any in-flight job to finish.
    // Together they close the race where a job is dequeued but not yet
    // marked "active", which would survive a drain and execute with stale mocks.
    await queue.pause();
    await consumer.worker.pause();
    transactionApiManager.destroyApi(currentChainId);
  });

  beforeEach(async () => {
    // Queue is paused (or not yet started for the first test) — safe to drain.
    await queue.drain(true);
    jest.clearAllMocks();
    cacheService.clear();
    // Resume worker, then queue (worker must be ready before jobs arrive).
    consumer.worker.resume();
    await queue.resume();
  });

  afterAll(async () => {
    await queue.close();
    await app.close();
  });

  describe('non-notifiable events', () => {
    it('should not deliver notifications for CHAIN_UPDATE', async () => {
      const event = chainUpdateEventBuilder().build();
      const subs = createSubscribers(1);

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(subs);

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
      });

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });
  });

  describe('pass-through events', () => {
    it.each([
      ['DELETED_MULTISIG_TRANSACTION', deletedMultisigTransactionEventBuilder],
      ['EXECUTED_MULTISIG_TRANSACTION', executedTransactionEventBuilder],
      ['MODULE_TRANSACTION', moduleTransactionEventBuilder],
    ])('should deliver to all subscribers for %s', async (_type, builderFn) => {
      const event = builderFn().build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subs = createSubscribers(2);

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(subs);
      notificationsRepository.enqueueNotification.mockResolvedValue();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledTimes(2);
      });

      for (const subscriber of subs) {
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            token: subscriber.cloudMessagingToken,
            deviceUuid: subscriber.deviceUuid,
          }),
        );
      }
    });
  });

  describe('incoming asset events', () => {
    const externalTransferCases: Array<[string, IncomingAssetFactory]> = [
      [
        'INCOMING_ETHER',
        (safeAddress): ReturnType<IncomingAssetFactory> => {
          const event = incomingEtherEventBuilder()
            .with('address', safeAddress)
            .build();
          const transfer = nativeTokenTransferBuilder()
            .with('from', addr())
            .with('transactionHash', event.txHash as Hash)
            .build();
          return { event, transfer };
        },
      ],
      [
        'INCOMING_TOKEN',
        (safeAddress): ReturnType<IncomingAssetFactory> => {
          const event = incomingTokenEventBuilder()
            .with('address', safeAddress)
            .build();
          const transfer = erc20TransferBuilder()
            .with('from', addr())
            .with('transactionHash', event.txHash as Hash)
            .build();
          return { event, transfer };
        },
      ],
    ];

    it.each(externalTransferCases)(
      'should deliver for %s when transfer is from external address',
      async (_type, factory) => {
        const safeAddress = addr();
        const { event, transfer } = factory(safeAddress);
        currentChainId = event.chainId;
        const chain = chainBuilder().with('chainId', event.chainId).build();
        const subs = createSubscribers(1);

        notificationsRepository.getSubscribersBySafe.mockResolvedValue(subs);
        notificationsRepository.enqueueNotification.mockResolvedValue();
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (
            url ===
            `${chain.transactionService}/api/v1/safes/${event.address}/incoming-transfers/`
          ) {
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', [transfer as never])
                  .build(),
              ),
              status: 200,
            });
          }
          return Promise.reject(`No matching rule for url: ${url}`);
        });

        await pushNotificationService.enqueueEvent(event);

        await retry(async () => {
          const counts = await queue.getJobCounts();
          expect(counts.active + counts.waiting + counts.delayed).toBe(0);
          expect(
            notificationsRepository.enqueueNotification,
          ).toHaveBeenCalledTimes(1);
        });
      },
    );

    const selfSendCases: Array<[string, IncomingAssetFactory]> = [
      [
        'INCOMING_ETHER',
        (safeAddress): ReturnType<IncomingAssetFactory> => {
          const event = incomingEtherEventBuilder()
            .with('address', safeAddress)
            .build();
          const transfer = nativeTokenTransferBuilder()
            .with('from', safeAddress)
            .with('transactionHash', event.txHash as Hash)
            .build();
          return { event, transfer };
        },
      ],
      [
        'INCOMING_TOKEN',
        (safeAddress): ReturnType<IncomingAssetFactory> => {
          const event = incomingTokenEventBuilder()
            .with('address', safeAddress)
            .build();
          const transfer = erc20TransferBuilder()
            .with('from', safeAddress)
            .with('transactionHash', event.txHash as Hash)
            .build();
          return { event, transfer };
        },
      ],
    ];

    it.each(selfSendCases)(
      'should suppress %s when transfer is self-send',
      async (_type, factory) => {
        const safeAddress = addr();
        const { event, transfer } = factory(safeAddress);
        currentChainId = event.chainId;
        const chain = chainBuilder().with('chainId', event.chainId).build();
        const subs = createSubscribers(1);

        notificationsRepository.getSubscribersBySafe.mockResolvedValue(subs);
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (
            url ===
            `${chain.transactionService}/api/v1/safes/${event.address}/incoming-transfers/`
          ) {
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', [transfer as never])
                  .build(),
              ),
              status: 200,
            });
          }
          return Promise.reject(`No matching rule for url: ${url}`);
        });

        await pushNotificationService.enqueueEvent(event);

        await retry(async () => {
          const counts = await queue.getJobCounts();
          expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        });

        expect(
          notificationsRepository.enqueueNotification,
        ).not.toHaveBeenCalled();
      },
    );
  });

  describe('PENDING_MULTISIG_TRANSACTION filtering', () => {
    it('should only deliver to unsigned owners', async () => {
      const ownerSigned = addr();
      const ownerUnsigned = addr();
      const nonOwner = addr();

      const safe = safeBuilder()
        .with('threshold', 2)
        .with('owners', [ownerSigned, ownerUnsigned])
        .build();
      const event = pendingTransactionEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('confirmations', [
          confirmationBuilder().with('owner', ownerSigned).build(),
        ])
        .build();

      const subscribers = createSubscribers(3);
      subscribers[0].subscriber = ownerSigned;
      subscribers[1].subscriber = ownerUnsigned;
      subscribers[2].subscriber = nonOwner;

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      notificationsRepository.enqueueNotification.mockResolvedValue();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v2/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            data: rawify(transaction),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', []).build()),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledTimes(1);
      });

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          token: subscribers[1].cloudMessagingToken,
          deviceUuid: subscribers[1].deviceUuid,
        }),
      );
    });

    it('should suppress when threshold is 1', async () => {
      const owner = addr();

      const safe = safeBuilder()
        .with('threshold', 1)
        .with('owners', [owner])
        .build();
      const event = pendingTransactionEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();

      const subscribers = createSubscribers(1);
      subscribers[0].subscriber = owner;

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v2/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            data: rawify(multisigTransactionBuilder().build()),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', []).build()),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
      });

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it('should deliver to delegate of owner', async () => {
      const owner = addr();
      const delegateAddress = addr();

      const safe = safeBuilder()
        .with('threshold', 2)
        .with('owners', [owner, addr()])
        .build();
      const event = pendingTransactionEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('confirmations', [])
        .build();

      const subscribers = createSubscribers(1);
      subscribers[0].subscriber = delegateAddress;

      const delegate = delegateBuilder()
        .with('delegate', delegateAddress)
        .with('delegator', owner)
        .build();

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      notificationsRepository.enqueueNotification.mockResolvedValue();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v2/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            data: rawify(transaction),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [delegate as never])
                .build(),
            ),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledTimes(1);
      });

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          token: subscribers[0].cloudMessagingToken,
          deviceUuid: subscribers[0].deviceUuid,
        }),
      );
    });

    it('should suppress delegates when all delegators have signed', async () => {
      const owner1 = addr();
      const owner2 = addr();
      const delegateAddress = addr();

      const safe = safeBuilder()
        .with('threshold', 2)
        .with('owners', [owner1, owner2])
        .build();
      const event = pendingTransactionEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('confirmations', [
          confirmationBuilder().with('owner', owner1).build(),
        ])
        .build();

      const subscribers = createSubscribers(1);
      subscribers[0].subscriber = delegateAddress;

      const delegate = delegateBuilder()
        .with('delegate', delegateAddress)
        .with('delegator', owner1)
        .build();

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v2/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            data: rawify(transaction),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [delegate as never])
                .build(),
            ),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
      });

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it('should exclude non-owner non-delegate subscribers', async () => {
      const owner1 = addr();
      const owner2 = addr();
      const randomAddress = addr();

      const safe = safeBuilder()
        .with('threshold', 2)
        .with('owners', [owner1, owner2])
        .build();
      const event = pendingTransactionEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('confirmations', [])
        .build();

      const subscribers = createSubscribers(1);
      subscribers[0].subscriber = randomAddress;

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v2/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            data: rawify(transaction),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', []).build()),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
      });

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });
  });

  describe('MESSAGE_CREATED filtering', () => {
    it('should deliver to unsigned owner', async () => {
      const ownerSigned = addr();
      const ownerUnsigned = addr();

      const safe = safeBuilder()
        .with('threshold', 2)
        .with('owners', [ownerSigned, ownerUnsigned])
        .build();
      const event = messageCreatedEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const message = messageBuilder()
        .with('safe', safe.address)
        .with('confirmations', [
          messageConfirmationBuilder().with('owner', ownerSigned).build(),
        ])
        .build();

      const subscribers = createSubscribers(2);
      subscribers[0].subscriber = ownerSigned;
      subscribers[1].subscriber = ownerUnsigned;

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      notificationsRepository.enqueueNotification.mockResolvedValue();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            data: rawify(message),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', []).build()),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledTimes(1);
      });

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          token: subscribers[1].cloudMessagingToken,
          deviceUuid: subscribers[1].deviceUuid,
        }),
      );
    });

    it('should suppress when threshold is 1', async () => {
      const owner = addr();

      const safe = safeBuilder()
        .with('threshold', 1)
        .with('owners', [owner])
        .build();
      const event = messageCreatedEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();

      const subscribers = createSubscribers(1);
      subscribers[0].subscriber = owner;

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            data: rawify(messageBuilder().build()),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', []).build()),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
      });

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it('should suppress when all owners have signed the message', async () => {
      const owner1 = addr();
      const owner2 = addr();

      const safe = safeBuilder()
        .with('threshold', 2)
        .with('owners', [owner1, owner2])
        .build();
      const event = messageCreatedEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const message = messageBuilder()
        .with('safe', safe.address)
        .with('confirmations', [
          messageConfirmationBuilder().with('owner', owner1).build(),
          messageConfirmationBuilder().with('owner', owner2).build(),
        ])
        .build();

      const subscribers = createSubscribers(2);
      subscribers[0].subscriber = owner1;
      subscribers[1].subscriber = owner2;

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            data: rawify(message),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', []).build()),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
      });

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it('should deliver to delegate of unsigned owner', async () => {
      const owner = addr();
      const otherOwner = addr();
      const delegateAddress = addr();

      const safe = safeBuilder()
        .with('threshold', 2)
        .with('owners', [owner, otherOwner])
        .build();
      const event = messageCreatedEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const message = messageBuilder()
        .with('safe', safe.address)
        .with('confirmations', [])
        .build();

      const subscribers = createSubscribers(1);
      subscribers[0].subscriber = delegateAddress;

      const delegate = delegateBuilder()
        .with('delegate', delegateAddress)
        .with('delegator', owner)
        .build();

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      notificationsRepository.enqueueNotification.mockResolvedValue();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            data: rawify(message),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [delegate as never])
                .build(),
            ),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledTimes(1);
      });

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          token: subscribers[0].cloudMessagingToken,
          deviceUuid: subscribers[0].deviceUuid,
        }),
      );
    });

    it('should suppress delegate when delegator has signed the message', async () => {
      const owner = addr();
      const otherOwner = addr();
      const delegateAddress = addr();

      const safe = safeBuilder()
        .with('threshold', 2)
        .with('owners', [owner, otherOwner])
        .build();
      const event = messageCreatedEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const message = messageBuilder()
        .with('safe', safe.address)
        .with('confirmations', [
          messageConfirmationBuilder().with('owner', owner).build(),
        ])
        .build();

      const subscribers = createSubscribers(1);
      subscribers[0].subscriber = delegateAddress;

      const delegate = delegateBuilder()
        .with('delegate', delegateAddress)
        .with('delegator', owner)
        .build();

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            data: rawify(message),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [delegate as never])
                .build(),
            ),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
      });

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it('should deliver to delegate whose delegator has not signed but suppress delegate whose delegator has signed', async () => {
      const owner1 = addr();
      const owner2 = addr();
      const otherOwner = addr();
      const delegateA = addr();
      const delegateB = addr();

      const safe = safeBuilder()
        .with('threshold', 2)
        .with('owners', [owner1, owner2, otherOwner])
        .build();
      const event = messageCreatedEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const message = messageBuilder()
        .with('safe', safe.address)
        .with('confirmations', [
          messageConfirmationBuilder().with('owner', owner2).build(),
        ])
        .build();

      const subscribers = createSubscribers(2);
      subscribers[0].subscriber = delegateA;
      subscribers[1].subscriber = delegateB;

      const delegateObjA = delegateBuilder()
        .with('delegate', delegateA)
        .with('delegator', owner1)
        .build();
      const delegateObjB = delegateBuilder()
        .with('delegate', delegateB)
        .with('delegator', owner2)
        .build();

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      notificationsRepository.enqueueNotification.mockResolvedValue();
      networkService.get.mockImplementation(({ url, networkRequest }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            data: rawify(message),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          const queriedDelegate = networkRequest?.params?.delegate;
          if (queriedDelegate === delegateA) {
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', [delegateObjA as never])
                  .build(),
              ),
              status: 200,
            });
          }
          if (queriedDelegate === delegateB) {
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', [delegateObjB as never])
                  .build(),
              ),
              status: 200,
            });
          }
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', []).build()),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledTimes(1);
      });

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          token: subscribers[0].cloudMessagingToken,
          deviceUuid: subscribers[0].deviceUuid,
        }),
      );
    });

    it('should exclude non-owner non-delegate subscribers', async () => {
      const owner1 = addr();
      const owner2 = addr();
      const randomAddress = addr();

      const safe = safeBuilder()
        .with('threshold', 2)
        .with('owners', [owner1, owner2])
        .build();
      const event = messageCreatedEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const message = messageBuilder()
        .with('safe', safe.address)
        .with('confirmations', [])
        .build();

      const subscribers = createSubscribers(1);
      subscribers[0].subscriber = randomAddress;

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            data: rawify(message),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', []).build()),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
      });

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });
  });

  describe('subscriber deduplication', () => {
    it('should deduplicate subscribers by cloudMessagingToken', async () => {
      const event = deletedMultisigTransactionEventBuilder().build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const sharedToken = faker.string.alphanumeric({ length: 20 });

      const subscribers = createSubscribers(2);
      subscribers[0].cloudMessagingToken = sharedToken;
      subscribers[1].cloudMessagingToken = sharedToken;

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      notificationsRepository.enqueueNotification.mockResolvedValue();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('fan-out resilience', () => {
    it('should retry and complete all deliveries even when one fails transiently', async () => {
      const event = moduleTransactionEventBuilder().build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subs = createSubscribers(3);

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(subs);
      notificationsRepository.enqueueNotification
        .mockRejectedValueOnce(new Error('FCM service unavailable'))
        .mockResolvedValue();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      // 4 calls: 3 subscribers × 1 delivery each + 1 retry for the failed delivery
      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledTimes(4);
      });
    });
  });

  describe('transient retry', () => {
    it('should retry delivery when enqueueNotification rejects transiently', async () => {
      const event = executedTransactionEventBuilder().build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subs = createSubscribers(1);

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(subs);
      notificationsRepository.enqueueNotification
        .mockRejectedValueOnce(new Error('Transient Redis error'))
        .mockResolvedValue();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification.mock.calls.length,
        ).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('mixed subscriber types', () => {
    it('should deliver only to unsigned owners and delegates for PENDING_MULTISIG_TRANSACTION', async () => {
      const owner0 = addr();
      const owner1 = addr();
      const owner2 = addr();
      const owner3 = addr();
      const delegateAddr = addr();
      const randomAddr = addr();

      const safe = safeBuilder()
        .with('threshold', 3)
        .with('owners', [owner0, owner1, owner2, owner3])
        .build();
      const event = pendingTransactionEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('confirmations', [
          confirmationBuilder().with('owner', owner0).build(),
        ])
        .build();

      const subscribers = createSubscribers(4);
      subscribers[0].subscriber = owner0;
      subscribers[1].subscriber = owner1;
      subscribers[2].subscriber = delegateAddr;
      subscribers[3].subscriber = randomAddr;

      const delegateObj = delegateBuilder()
        .with('delegate', delegateAddr)
        .with('delegator', owner2)
        .build();

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      notificationsRepository.enqueueNotification.mockResolvedValue();
      networkService.get.mockImplementation(({ url, networkRequest }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v2/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            data: rawify(transaction),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          const queriedDelegate = networkRequest?.params?.delegate;
          if (queriedDelegate === delegateAddr) {
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', [delegateObj as never])
                  .build(),
              ),
              status: 200,
            });
          }
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', []).build()),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledTimes(2);
      });

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          token: subscribers[1].cloudMessagingToken,
          deviceUuid: subscribers[1].deviceUuid,
        }),
      );
      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          token: subscribers[2].cloudMessagingToken,
          deviceUuid: subscribers[2].deviceUuid,
        }),
      );
    });

    it('should deliver only to unsigned owners and delegates for MESSAGE_CREATED', async () => {
      const owner0 = addr();
      const owner1 = addr();
      const owner2 = addr();
      const owner3 = addr();
      const delegateAddr = addr();
      const randomAddr = addr();

      const safe = safeBuilder()
        .with('threshold', 3)
        .with('owners', [owner0, owner1, owner2, owner3])
        .build();
      const event = messageCreatedEventBuilder()
        .with('address', safe.address)
        .build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const message = messageBuilder()
        .with('safe', safe.address)
        .with('confirmations', [
          messageConfirmationBuilder().with('owner', owner0).build(),
        ])
        .build();

      const subscribers = createSubscribers(4);
      subscribers[0].subscriber = owner0;
      subscribers[1].subscriber = owner1;
      subscribers[2].subscriber = delegateAddr;
      subscribers[3].subscriber = randomAddr;

      const delegateObj = delegateBuilder()
        .with('delegate', delegateAddr)
        .with('delegator', owner2)
        .build();

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      notificationsRepository.enqueueNotification.mockResolvedValue();
      networkService.get.mockImplementation(({ url, networkRequest }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            data: rawify(message),
            status: 200,
          });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          const queriedDelegate = networkRequest?.params?.delegate;
          if (queriedDelegate === delegateAddr) {
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', [delegateObj as never])
                  .build(),
              ),
              status: 200,
            });
          }
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', []).build()),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenCalledTimes(2);
      });

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          token: subscribers[1].cloudMessagingToken,
          deviceUuid: subscribers[1].deviceUuid,
        }),
      );
      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          token: subscribers[2].cloudMessagingToken,
          deviceUuid: subscribers[2].deviceUuid,
        }),
      );
    });
  });

  describe('unregistered token behavior', () => {
    it('should retry when enqueueNotification rejects persistently', async () => {
      const event = executedTransactionEventBuilder().build();
      currentChainId = event.chainId;
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subs = createSubscribers(1);

      notificationsRepository.getSubscribersBySafe.mockResolvedValue(subs);
      notificationsRepository.enqueueNotification.mockRejectedValue(
        new Error('Requested entity was not found — UNREGISTERED'),
      );
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await pushNotificationService.enqueueEvent(event);

      await retry(async () => {
        const counts = await queue.getJobCounts();
        expect(counts.active + counts.waiting + counts.delayed).toBe(0);
        expect(
          notificationsRepository.enqueueNotification.mock.calls.length,
        ).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
