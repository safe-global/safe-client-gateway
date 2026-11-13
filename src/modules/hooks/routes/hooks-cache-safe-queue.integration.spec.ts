// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  createTestApplication,
  initTestApplication,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import type { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '#/datasources/cache/cache.router';
import { CacheService } from '#/datasources/cache/cache.service.interface';
import type { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import {
  type INetworkService,
  NetworkService,
} from '#/datasources/network/network.service.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import {
  deletedDelegateEventBuilder,
  newDelegateEventBuilder,
  updatedDelegateEventBuilder,
} from '#/modules/hooks/routes/entities/__tests__/delegate-events.builder';
import { deletedMultisigTransactionEventBuilder } from '#/modules/hooks/routes/entities/__tests__/deleted-multisig-transaction.builder';
import { executedTransactionEventBuilder } from '#/modules/hooks/routes/entities/__tests__/executed-transaction.builder';
import { messageCreatedEventBuilder } from '#/modules/hooks/routes/entities/__tests__/message-created.builder';
import { newConfirmationEventBuilder } from '#/modules/hooks/routes/entities/__tests__/new-confirmation.builder';
import { newMessageConfirmationEventBuilder } from '#/modules/hooks/routes/entities/__tests__/new-message-confirmation.builder';
import { pendingTransactionEventBuilder } from '#/modules/hooks/routes/entities/__tests__/pending-transaction.builder';
import { TransactionEventType } from '#/modules/hooks/routes/entities/event-type.entity';
import { IQueuesApiService } from '#/modules/queues/datasources/queues-api.service.interface';
import { rawify } from '#/validation/entities/raw.entity';

function consumeMessageOf(event: object): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(event)),
    fields: {
      deliveryTag: faker.number.int(),
      redelivered: false,
      exchange: faker.string.alpha(),
      routingKey: faker.string.alpha(),
      consumerTag: faker.string.alpha(),
    },
    properties: {
      contentType: undefined,
      contentEncoding: undefined,
      headers: undefined,
      deliveryMode: undefined,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId: undefined,
      timestamp: undefined,
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  };
}

describe('Hook Events for Cache (safe-queue service enabled)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let fakeCacheService: FakeCacheService;
  let networkService: MockedObject<INetworkService>;
  let consume: (msg: ConsumeMessage) => Promise<void>;

  beforeEach(async () => {
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        safeQueueService: true,
      },
    });
    const moduleFixture = await createTestModule({
      config: testConfiguration,
    });

    app = createTestApplication(moduleFixture);

    fakeCacheService = moduleFixture.get<FakeCacheService>(CacheService);
    safeConfigUrl = moduleFixture
      .get<IConfigurationService>(IConfigurationService)
      .getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);
    const queuesApiService: MockedObject<IQueuesApiService> =
      moduleFixture.get(IQueuesApiService);
    queuesApiService.subscribe.mockImplementation((_queueName, fn) => {
      consume = fn;
      return Promise.resolve();
    });

    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  function mockChain(chainId: string): void {
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chainId}`) {
        return Promise.resolve({
          data: rawify(chainBuilder().with('chainId', chainId).build()),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
  }

  async function prime(cacheDirs: Array<CacheDir>): Promise<void> {
    for (const cacheDir of cacheDirs) {
      const value = faker.string.alpha({ length: 8 });
      await fakeCacheService.hSet(
        cacheDir,
        value,
        faker.number.int({ min: 1 }),
      );
      await expect(fakeCacheService.hGet(cacheDir)).resolves.toBe(value);
    }
  }

  async function expectCleared(cacheDirs: Array<CacheDir>): Promise<void> {
    for (const cacheDir of cacheDirs) {
      await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
    }
  }

  describe('multisig transaction events', () => {
    it.each([
      {
        type: TransactionEventType.PENDING_MULTISIG_TRANSACTION,
        build: (chainId: string) =>
          pendingTransactionEventBuilder().with('chainId', chainId).build(),
      },
      {
        type: TransactionEventType.NEW_CONFIRMATION,
        build: (chainId: string) =>
          newConfirmationEventBuilder().with('chainId', chainId).build(),
      },
      {
        type: TransactionEventType.DELETED_MULTISIG_TRANSACTION,
        build: (chainId: string) =>
          deletedMultisigTransactionEventBuilder()
            .with('chainId', chainId)
            .build(),
      },
      {
        type: TransactionEventType.EXECUTED_MULTISIG_TRANSACTION,
        build: (chainId: string) =>
          executedTransactionEventBuilder().with('chainId', chainId).build(),
      },
    ])(
      '$type clears the queue-service and tx-service transaction caches',
      async ({ build }) => {
        const chainId = faker.string.numeric();
        const event = build(chainId);
        const queuedTransactionsDir =
          CacheRouter.getSafeQueuedTransactionsCacheDir({
            chainId,
            safeAddress: event.address,
            nonceOrder: faker.helpers.arrayElement(['asc', 'desc']),
            limit: faker.number.int({ min: 1, max: 100 }),
            offset: faker.number.int({ min: 0, max: 100 }),
          });
        const queueTransactionDir =
          CacheRouter.getSafeQueueMultisigTransactionCacheDir({
            chainId,
            safeTransactionHash: event.safeTxHash,
          });
        const txServiceTransactionsDir =
          CacheRouter.getMultisigTransactionsCacheDir({
            chainId,
            safeAddress: event.address,
          });
        const txServiceTransactionDir =
          CacheRouter.getMultisigTransactionCacheDir({
            chainId,
            safeTransactionHash: event.safeTxHash,
          });
        const cacheDirs = [
          queuedTransactionsDir,
          queueTransactionDir,
          txServiceTransactionsDir,
          txServiceTransactionDir,
        ];
        await prime(cacheDirs);
        mockChain(chainId);

        await consume(consumeMessageOf(event));

        await expectCleared(cacheDirs);
      },
    );

    it('leaves the queue-service caches of other Safes and transactions untouched', async () => {
      const chainId = faker.string.numeric();
      const event = pendingTransactionEventBuilder()
        .with('chainId', chainId)
        .build();
      const otherQueuedTransactionsDir =
        CacheRouter.getSafeQueuedTransactionsCacheDir({
          chainId,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        });
      const otherQueueTransactionDir =
        CacheRouter.getSafeQueueMultisigTransactionCacheDir({
          chainId,
          safeTransactionHash: faker.string.hexadecimal({ length: 64 }),
        });
      const value = faker.string.alpha({ length: 8 });
      const ttl = faker.number.int({ min: 1 });
      await fakeCacheService.hSet(otherQueuedTransactionsDir, value, ttl);
      await fakeCacheService.hSet(otherQueueTransactionDir, value, ttl);
      mockChain(chainId);

      await consume(consumeMessageOf(event));

      await expect(
        fakeCacheService.hGet(otherQueuedTransactionsDir),
      ).resolves.toBe(value);
      await expect(
        fakeCacheService.hGet(otherQueueTransactionDir),
      ).resolves.toBe(value);
    });
  });

  describe('message events', () => {
    it('MESSAGE_CREATED clears the queue-service and tx-service messages of the Safe', async () => {
      const chainId = faker.string.numeric();
      const event = messageCreatedEventBuilder()
        .with('chainId', chainId)
        .build();
      const pagination = {
        limit: faker.number.int({ min: 1, max: 100 }),
        offset: faker.number.int({ min: 0, max: 100 }),
      };
      const cacheDirs = [
        CacheRouter.getSafeQueueMessagesBySafeCacheDir({
          chainId,
          safeAddress: event.address,
          ...pagination,
        }),
        CacheRouter.getMessagesBySafeCacheDir({
          chainId,
          safeAddress: event.address,
          ...pagination,
        }),
      ];
      await prime(cacheDirs);
      mockChain(chainId);

      await consume(consumeMessageOf(event));

      await expectCleared(cacheDirs);
    });

    it('MESSAGE_CONFIRMATION clears the queue-service and tx-service message and messages of the Safe', async () => {
      const chainId = faker.string.numeric();
      const event = newMessageConfirmationEventBuilder()
        .with('chainId', chainId)
        .build();
      const pagination = {
        limit: faker.number.int({ min: 1, max: 100 }),
        offset: faker.number.int({ min: 0, max: 100 }),
      };
      const cacheDirs = [
        CacheRouter.getSafeQueueMessageByHashCacheDir({
          chainId,
          messageHash: event.messageHash,
        }),
        CacheRouter.getSafeQueueMessagesBySafeCacheDir({
          chainId,
          safeAddress: event.address,
          ...pagination,
        }),
        CacheRouter.getMessageByHashCacheDir({
          chainId,
          messageHash: event.messageHash,
        }),
        CacheRouter.getMessagesBySafeCacheDir({
          chainId,
          safeAddress: event.address,
          ...pagination,
        }),
      ];
      await prime(cacheDirs);
      mockChain(chainId);

      await consume(consumeMessageOf(event));

      await expectCleared(cacheDirs);
    });
  });

  describe('delegate events', () => {
    it.each([
      {
        type: TransactionEventType.NEW_DELEGATE,
        build: (chainId: string, address: Address | null) =>
          newDelegateEventBuilder()
            .with('chainId', chainId)
            .with('address', address)
            .build(),
      },
      {
        type: TransactionEventType.UPDATED_DELEGATE,
        build: (chainId: string, address: Address | null) =>
          updatedDelegateEventBuilder()
            .with('chainId', chainId)
            .with('address', address)
            .build(),
      },
      {
        type: TransactionEventType.DELETED_DELEGATE,
        build: (chainId: string, address: Address | null) =>
          deletedDelegateEventBuilder()
            .with('chainId', chainId)
            .with('address', address)
            .build(),
      },
    ])(
      '$type clears the queue-service and tx-service delegates of the Safe',
      async ({ build }) => {
        const chainId = faker.string.numeric();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const event = build(chainId, safeAddress);
        const delegateArgs = {
          chainId,
          safeAddress,
          delegate: event.delegate,
          delegator: event.delegator,
          label: event.label,
          limit: faker.number.int({ min: 1, max: 100 }),
          offset: faker.number.int({ min: 0, max: 100 }),
        };
        const cacheDirs = [
          CacheRouter.getSafeQueueDelegatesCacheDir(delegateArgs),
          CacheRouter.getDelegatesCacheDir(delegateArgs),
        ];
        await prime(cacheDirs);
        mockChain(chainId);

        await consume(consumeMessageOf(event));

        await expectCleared(cacheDirs);
      },
    );

    it.each([
      {
        type: TransactionEventType.NEW_DELEGATE,
        build: (chainId: string) =>
          newDelegateEventBuilder()
            .with('chainId', chainId)
            .with('address', null)
            .build(),
      },
      {
        type: TransactionEventType.UPDATED_DELEGATE,
        build: (chainId: string) =>
          updatedDelegateEventBuilder()
            .with('chainId', chainId)
            .with('address', null)
            .build(),
      },
      {
        type: TransactionEventType.DELETED_DELEGATE,
        build: (chainId: string) =>
          deletedDelegateEventBuilder()
            .with('chainId', chainId)
            .with('address', null)
            .build(),
      },
    ])(
      '$type without a Safe address clears the Safe-less queue-service and tx-service delegates',
      async ({ build }) => {
        const chainId = faker.string.numeric();
        const event = build(chainId);
        const delegateArgs = {
          chainId,
          delegate: event.delegate,
          delegator: event.delegator,
        };
        const cacheDirs = [
          CacheRouter.getSafeQueueDelegatesCacheDir(delegateArgs),
          CacheRouter.getDelegatesCacheDir(delegateArgs),
        ];
        await prime(cacheDirs);
        mockChain(chainId);

        await consume(consumeMessageOf(event));

        await expectCleared(cacheDirs);
      },
    );
  });
});
