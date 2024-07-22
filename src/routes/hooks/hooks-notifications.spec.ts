import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { Server } from 'net';
import { chainUpdateEventBuilder } from '@/routes/hooks/entities/__tests__/chain-update.builder';
import { safeAppsEventBuilder } from '@/routes/hooks/entities/__tests__/safe-apps-update.builder';
import { outgoingEtherEventBuilder } from '@/routes/hooks/entities/__tests__/outgoing-ether.builder';
import { outgoingTokenEventBuilder } from '@/routes/hooks/entities/__tests__/outgoing-token.builder';
import { newConfirmationEventBuilder } from '@/routes/hooks/entities/__tests__/new-confirmation.builder';
import { safeCreatedEventBuilder } from '@/routes/hooks/entities/__tests__/safe-created.build';
import { deletedMultisigTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/deleted-multisig-transaction.builder';
import { executedTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/executed-transaction.builder';
import { moduleTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/module-transaction.builder';
import { incomingEtherEventBuilder } from '@/routes/hooks/entities/__tests__/incoming-ether.builder';
import { incomingTokenEventBuilder } from '@/routes/hooks/entities/__tests__/incoming-token.builder';
import { newMessageConfirmationEventBuilder } from '@/routes/hooks/entities/__tests__/new-message-confirmation.builder';
import request from 'supertest';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { PushNotificationsApiModule } from '@/datasources/push-notifications-api/push-notifications-api.module';
import { TestPushNotificationsApiModule } from '@/datasources/push-notifications-api/__tests__/test.push-notifications-api.module';
import { NotificationsDatasourceModule } from '@/datasources/accounts/notifications/notifications.datasource.module';
import { TestNotificationsDatasourceModule } from '@/datasources/accounts/notifications/__tests__/test.notifications.datasource.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { INotificationsDatasource } from '@/domain/interfaces/notifications.datasource.interface';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { nativeTokenTransferBuilder } from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { erc721TransferBuilder } from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { pendingTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/pending-transaction.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { messageBuilder } from '@/domain/messages/entities/__tests__/message.builder';
import { messageCreatedEventBuilder } from '@/routes/hooks/entities/__tests__/message-created.builder';
import { messageConfirmationBuilder } from '@/domain/messages/entities/__tests__/message-confirmation.builder';

describe('Post Hook Events for Notifications (Unit)', () => {
  let app: INestApplication<Server>;
  let pushNotificationsApi: jest.MockedObjectDeep<IPushNotificationsApi>;
  let notificationsDatasource: jest.MockedObjectDeep<INotificationsDatasource>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let configurationService: IConfigurationService;
  let authToken: string;
  let safeConfigUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(NotificationsDatasourceModule)
      .useModule(TestNotificationsDatasourceModule)
      .overrideModule(PushNotificationsApiModule)
      .useModule(TestPushNotificationsApiModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();
    app = moduleFixture.createNestApplication();

    networkService = moduleFixture.get(NetworkService);
    pushNotificationsApi = moduleFixture.get(IPushNotificationsApi);
    notificationsDatasource = moduleFixture.get(INotificationsDatasource);
    configurationService = moduleFixture.get(IConfigurationService);
    authToken = configurationService.getOrThrow('auth.token');
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');

    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(
    [
      chainUpdateEventBuilder().build(),
      safeAppsEventBuilder().build(),
      outgoingEtherEventBuilder().build(),
      outgoingTokenEventBuilder().build(),
      newConfirmationEventBuilder().build(),
      newMessageConfirmationEventBuilder().build(),
      safeCreatedEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )('should not enqueue notifications for %s events', async (_, event) => {
    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
  });

  it.each(
    [
      deletedMultisigTransactionEventBuilder().build(),
      executedTransactionEventBuilder().build(),
      moduleTransactionEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )('should enqueue %s event notifications as is', async (_, event) => {
    const subscribers = Array.from(
      {
        length: faker.number.int({ min: 1, max: 5 }),
      },
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        cloudMessagingToken: faker.string.alphanumeric(),
      }),
    );
    notificationsDatasource.getSubscribersWithTokensBySafe.mockResolvedValue(
      subscribers,
    );

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
      subscribers.length,
    );
    subscribers.forEach((subscriber, i) => {
      expect(pushNotificationsApi.enqueueNotification).toHaveBeenNthCalledWith(
        i + 1,
        subscriber.cloudMessagingToken,
        { data: event },
      );
    });
  });

  it.each(
    [
      incomingEtherEventBuilder().build(),
      incomingTokenEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )(
    'should enqueue %s event notifications when receiving assets from other parties',
    async (_, event) => {
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = Array.from(
        {
          length: faker.number.int({ min: 1, max: 5 }),
        },
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
      );
      notificationsDatasource.getSubscribersWithTokensBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: chain,
            status: 200,
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/safes/${event.address}/incoming-transfers/`
        ) {
          const transfers = [
            nativeTokenTransferBuilder()
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
            erc721TransferBuilder()
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
            erc20TransferBuilder()
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
          ];
          return Promise.resolve({
            status: 200,
            data: pageBuilder()
              .with('results', [faker.helpers.arrayElement(transfers)])
              .build(),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          pushNotificationsApi.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, subscriber.cloudMessagingToken, {
          data: event,
        });
      });
    },
  );

  it.each(
    [
      incomingEtherEventBuilder().build(),
      incomingTokenEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )(
    'should not enqueue %s event notifications when receiving assets from the Safe itself',
    async (_, event) => {
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = Array.from(
        {
          length: faker.number.int({ min: 1, max: 5 }),
        },
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
      );
      notificationsDatasource.getSubscribersWithTokensBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: chain,
            status: 200,
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/safes/${event.address}/incoming-transfers/`
        ) {
          const transfers = [
            nativeTokenTransferBuilder()
              .with('from', event.address)
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
            erc721TransferBuilder()
              .with('from', event.address)
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
            erc20TransferBuilder()
              .with('from', event.address)
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
          ];
          return Promise.resolve({
            status: 200,
            data: pageBuilder()
              .with('results', [faker.helpers.arrayElement(transfers)])
              .build(),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    },
  );

  it("should enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 and the subscriber hasn't yet signed", async () => {
    const event = pendingTransactionEventBuilder().build();
    const chain = chainBuilder().with('chainId', event.chainId).build();
    const safe = safeBuilder()
      .with('address', event.address)
      .with('threshold', faker.number.int({ min: 2 }))
      .build();
    const multisigTransaction = multisigTransactionBuilder()
      .with('safe', event.address)
      .build();
    const subscribers = Array.from(
      {
        length: faker.number.int({ min: 1, max: 5 }),
      },
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        cloudMessagingToken: faker.string.alphanumeric(),
      }),
    );
    notificationsDatasource.getSubscribersWithTokensBySafe.mockResolvedValue(
      subscribers,
    );

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: chain,
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${event.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: safe,
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
      ) {
        return Promise.resolve({
          status: 200,
          data: multisigTransaction,
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
      subscribers.length,
    );
    subscribers.forEach((subscriber, i) => {
      expect(pushNotificationsApi.enqueueNotification).toHaveBeenNthCalledWith(
        i + 1,
        subscriber.cloudMessagingToken,
        {
          data: {
            ...event,
            type: 'CONFIRMATION_REQUEST',
          },
        },
      );
    });
  });

  it('should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold of 1', async () => {
    const event = pendingTransactionEventBuilder().build();
    const chain = chainBuilder().with('chainId', event.chainId).build();
    const safe = safeBuilder()
      .with('address', event.address)
      .with('threshold', 1)
      .build();
    const subscribers = Array.from(
      {
        length: faker.number.int({ min: 1, max: 5 }),
      },
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        cloudMessagingToken: faker.string.alphanumeric(),
      }),
    );
    notificationsDatasource.getSubscribersWithTokensBySafe.mockResolvedValue(
      subscribers,
    );

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: chain,
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${event.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: safe,
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
  });

  it('should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 but the subscriber has signed', async () => {
    const event = pendingTransactionEventBuilder().build();
    const chain = chainBuilder().with('chainId', event.chainId).build();
    const safe = safeBuilder()
      .with('address', event.address)
      .with('threshold', faker.number.int({ min: 2 }))
      .build();
    const subscribers = Array.from(
      {
        length: faker.number.int({ min: 1, max: 5 }),
      },
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        cloudMessagingToken: faker.string.alphanumeric(),
      }),
    );
    notificationsDatasource.getSubscribersWithTokensBySafe.mockResolvedValue(
      subscribers,
    );
    const multisigTransaction = multisigTransactionBuilder()
      .with(
        'confirmations',
        subscribers.map((subscriber) => {
          return confirmationBuilder()
            .with('owner', subscriber.subscriber)
            .build();
        }),
      )
      .build();

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: chain,
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${event.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: safe,
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/safes/${event.address}/multisig-transactions/`
      ) {
        return Promise.resolve({
          status: 200,
          data: multisigTransaction,
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
  });

  it("should enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 and the subscriber hasn't yet signed", async () => {
    const event = messageCreatedEventBuilder().build();
    const chain = chainBuilder().with('chainId', event.chainId).build();
    const safe = safeBuilder()
      .with('address', event.address)
      .with('threshold', faker.number.int({ min: 2 }))
      .build();
    const message = messageBuilder()
      .with('messageHash', event.messageHash as `0x${string}`)
      .build();
    const subscribers = Array.from(
      {
        length: faker.number.int({ min: 1, max: 5 }),
      },
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        cloudMessagingToken: faker.string.alphanumeric(),
      }),
    );
    notificationsDatasource.getSubscribersWithTokensBySafe.mockResolvedValue(
      subscribers,
    );

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: chain,
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${event.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: safe,
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/messages/${event.messageHash}`
      ) {
        return Promise.resolve({
          status: 200,
          data: message,
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
      subscribers.length,
    );
    subscribers.forEach((subscriber, i) => {
      expect(pushNotificationsApi.enqueueNotification).toHaveBeenNthCalledWith(
        i + 1,
        subscriber.cloudMessagingToken,
        {
          data: {
            ...event,
            type: 'MESSAGE_CONFIRMATION_REQUEST',
          },
        },
      );
    });
  });

  it('should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold of 1', async () => {
    const event = messageCreatedEventBuilder().build();
    const chain = chainBuilder().with('chainId', event.chainId).build();
    const safe = safeBuilder()
      .with('address', event.address)
      .with('threshold', 1)
      .build();
    const subscribers = Array.from(
      {
        length: faker.number.int({ min: 1, max: 5 }),
      },
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        cloudMessagingToken: faker.string.alphanumeric(),
      }),
    );
    notificationsDatasource.getSubscribersWithTokensBySafe.mockResolvedValue(
      subscribers,
    );

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: chain,
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${event.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: safe,
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
  });

  it('should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 but the subscriber has signed', async () => {
    const event = messageCreatedEventBuilder().build();
    const chain = chainBuilder().with('chainId', event.chainId).build();
    const safe = safeBuilder()
      .with('address', event.address)
      .with('threshold', faker.number.int({ min: 2 }))
      .build();
    const subscribers = Array.from(
      {
        length: faker.number.int({ min: 1, max: 5 }),
      },
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        cloudMessagingToken: faker.string.alphanumeric(),
      }),
    );
    notificationsDatasource.getSubscribersWithTokensBySafe.mockResolvedValue(
      subscribers,
    );
    const message = messageBuilder()
      .with('messageHash', event.messageHash as `0x${string}`)
      .with(
        'confirmations',
        subscribers.map((subscriber) => {
          return messageConfirmationBuilder()
            .with('owner', subscriber.subscriber)
            .build();
        }),
      )
      .build();

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: chain,
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${event.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: safe,
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/messages/${event.messageHash}`
      ) {
        return Promise.resolve({
          status: 200,
          data: message,
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
  });

  it('should not fail to send all notifications if one throws', async () => {
    const events = [
      chainUpdateEventBuilder().build(),
      safeAppsEventBuilder().build(),
      outgoingEtherEventBuilder().build(),
      outgoingTokenEventBuilder().build(),
      newConfirmationEventBuilder().build(),
      newMessageConfirmationEventBuilder().build(),
      safeCreatedEventBuilder().build(),
    ];

    pushNotificationsApi.enqueueNotification
      .mockRejectedValueOnce(new Error('Error enqueueing notification'))
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('Other error'))
      .mockResolvedValue();

    for (const event of events) {
      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        // Doesn't throw
        .expect(202);
    }
  });
});
