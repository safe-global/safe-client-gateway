import type { INestApplication } from '@nestjs/common';
import configuration from '@/config/entities/__tests__/configuration';
import type { Server } from 'net';
import { chainUpdateEventBuilder } from '@/routes/hooks/entities/__tests__/chain-update.builder';
import { safeAppsEventBuilder } from '@/routes/hooks/entities/__tests__/safe-apps-update.builder';
import { outgoingEtherEventBuilder } from '@/routes/hooks/entities/__tests__/outgoing-ether.builder';
import { outgoingTokenEventBuilder } from '@/routes/hooks/entities/__tests__/outgoing-token.builder';
import { newConfirmationEventBuilder } from '@/routes/hooks/entities/__tests__/new-confirmation.builder';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { safeCreatedEventBuilder } from '@/routes/hooks/entities/__tests__/safe-created.build';
import { deletedMultisigTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/deleted-multisig-transaction.builder';
import { executedTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/executed-transaction.builder';
import { moduleTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/module-transaction.builder';
import { incomingEtherEventBuilder } from '@/routes/hooks/entities/__tests__/incoming-ether.builder';
import { incomingTokenEventBuilder } from '@/routes/hooks/entities/__tests__/incoming-token.builder';
import { newMessageConfirmationEventBuilder } from '@/routes/hooks/entities/__tests__/new-message-confirmation.builder';
import { PushNotificationsApiModule } from '@/datasources/push-notifications-api/push-notifications-api.module';
import { TestPushNotificationsApiModule } from '@/datasources/push-notifications-api/__tests__/test.push-notifications-api.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
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
import type { UUID } from 'crypto';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import { TestNotificationsRepositoryV2Module } from '@/domain/notifications/v2/test.notification.repository.module';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';
import { IQueuesApiService } from '@/datasources/queues/queues-api.service.interface';
import { reorgDetectedEventBuilder } from '@/routes/hooks/entities/__tests__/reorg-detected.builder';
import {
  deletedDelegateEventBuilder,
  newDelegateEventBuilder,
  updatedDelegateEventBuilder,
} from '@/routes/hooks/entities/__tests__/delegate-events.builder';
import type { ConsumeMessage } from 'amqplib';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createTestModule } from '@/__tests__/testing-module';

function getSubscriptionCallback(
  queuesApiService: jest.MockedObjectDeep<IQueuesApiService>,
): (msg: ConsumeMessage) => Promise<void> {
  // First call, second argument
  return queuesApiService.subscribe.mock.calls[0][1];
}

// TODO: Migrate to E2E tests as TransactionEventType events are already being received via queue.
describe('Hook Events for Notifications (Unit) pt. 1', () => {
  let app: INestApplication<Server>;
  let notificationsRepository: jest.MockedObjectDeep<INotificationsRepositoryV2>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let configurationService: IConfigurationService;
  let safeConfigUrl: string;
  let queuesApiService: jest.MockedObjectDeep<IQueuesApiService>;

  async function initApp(): Promise<void> {
    const moduleFixture = await createTestModule({
      config: configuration,
      modules: [
        {
          originalModule: PushNotificationsApiModule,
          testModule: TestPushNotificationsApiModule,
        },
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    app = moduleFixture.createNestApplication();

    networkService = moduleFixture.get(NetworkService);
    configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    queuesApiService = moduleFixture.get(IQueuesApiService);
    notificationsRepository = moduleFixture.get(INotificationsRepositoryV2);

    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    await initApp();
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
      reorgDetectedEventBuilder().build(),
      newDelegateEventBuilder().build(),
      updatedDelegateEventBuilder().build(),
      deletedDelegateEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )('should not enqueue notifications for %s events', async (_, event) => {
    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(event)) } as ConsumeMessage);

    expect(notificationsRepository.enqueueNotification).not.toHaveBeenCalled();
  });

  it.each(
    [
      deletedMultisigTransactionEventBuilder().build(),
      executedTransactionEventBuilder().build(),
      moduleTransactionEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )('should enqueue %s event notifications as is', async (_, event) => {
    const subscribers = faker.helpers.multiple(
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      }),
      {
        count: { min: 1, max: 5 },
      },
    );
    const chain = chainBuilder().build();
    notificationsRepository.getSubscribersBySafe.mockResolvedValue(subscribers);
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: rawify(chain),
          status: 200,
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(event)) } as ConsumeMessage);

    expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
      subscribers.length,
    );
    subscribers.forEach((subscriber, i) => {
      expect(
        notificationsRepository.enqueueNotification,
      ).toHaveBeenNthCalledWith(i + 1, {
        token: subscriber.cloudMessagingToken,
        deviceUuid: subscriber.deviceUuid,
        notification: { data: event },
      });
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
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: faker.helpers.arrayElement([
            getAddress(faker.finance.ethereumAddress()),
            null,
          ]),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
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
            data: rawify(
              pageBuilder()
                .with('results', [faker.helpers.arrayElement(transfers)])
                .build(),
            ),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, {
          token: subscriber.cloudMessagingToken,
          deviceUuid: subscriber.deviceUuid,
          notification: { data: event },
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
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: faker.helpers.arrayElement([
            getAddress(faker.finance.ethereumAddress()),
            null,
          ]),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
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
            data: rawify(
              pageBuilder()
                .with('results', [faker.helpers.arrayElement(transfers)])
                .build(),
            ),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    },
  );

  describe('owners', () => {
    it("should enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 and the owner hasn't yet signed", async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const multisigTransaction = multisigTransactionBuilder()
        .with('safe', event.address)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, {
          token: subscriber.cloudMessagingToken,
          deviceUuid: subscriber.deviceUuid,
          notification: { data: { ...event, type: 'CONFIRMATION_REQUEST' } },
        });
      });
    });

    it('should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold of 1', async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', 1)
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it('should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 but the owner has signed', async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const multisigTransaction = multisigTransactionBuilder()
        .with(
          'confirmations',
          await Promise.all(
            subscribers.map((subscriber) => {
              return confirmationBuilder()
                .with('owner', subscriber.subscriber)
                .build();
            }),
          ),
        )
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it("should only enqueue PENDING_MULTISIG_TRANSACTION event notifications for those that haven't signed", async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const signers = Array.from({ length: 5 }, () => {
        const privateKey = generatePrivateKey();
        return privateKeyToAccount(privateKey);
      });
      const owners = signers.map((signer) => signer.address);
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with('owners', owners)
        .build();
      const subscribers = owners.map((owner) => ({
        subscriber: owner,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      }));
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      const multisigTransaction = await multisigTransactionBuilder()
        .with('safe', event.address)
        .buildWithConfirmations({
          chainId: event.chainId,
          safe,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length - 1,
          }),
        });

      const delegates = owners
        .filter((owner) => {
          return multisigTransaction.confirmations!.every(
            (confirmation) => confirmation.owner !== owner,
          );
        })
        .map((owner) => {
          return delegateBuilder()
            .with('delegate', getAddress(faker.finance.ethereumAddress()))
            .with('delegator', owner)
            .with('safe', event.address)
            .build();
        });
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length - multisigTransaction.confirmations!.length,
      );
      expect(
        notificationsRepository.enqueueNotification.mock.calls,
      ).toStrictEqual(
        subscribers
          .filter((subscriber) => {
            return multisigTransaction.confirmations!.every((confirmation) => {
              return confirmation.owner !== subscriber.subscriber;
            });
          })
          .map((subscriber) => {
            return [
              {
                token: subscriber.cloudMessagingToken,
                deviceUuid: subscriber.deviceUuid,
                notification: {
                  data: { ...event, type: 'CONFIRMATION_REQUEST' },
                },
              },
            ];
          }),
      );
    });

    it("should enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 and the owner hasn't yet signed", async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = safe.owners.map((owner) => {
        return delegateBuilder()
          .with('delegate', getAddress(faker.finance.ethereumAddress()))
          .with('delegator', owner)
          .with('safe', event.address)
          .build();
      });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, {
          token: subscriber.cloudMessagingToken,
          deviceUuid: subscriber.deviceUuid,
          notification: {
            data: { ...event, type: 'MESSAGE_CONFIRMATION_REQUEST' },
          },
        });
      });
    });

    it('should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold of 1', async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', 1)
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it('should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 but the owner has signed', async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
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
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it("should only enqueue MESSAGE_CONFIRMATION_REQUEST event notifications for those that haven't signed", async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const owners = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ];
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with('owners', owners)
        .build();
      const subscribers = owners.map((owner) => ({
        subscriber: owner,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      }));
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const confirmations = faker.helpers
        .arrayElements(owners, { min: 1, max: owners.length - 1 })
        .map((owner) => {
          return messageConfirmationBuilder().with('owner', owner).build();
        });
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .with('confirmations', confirmations)
        .build();

      const delegates = owners
        .filter((owner) => {
          return confirmations.every(
            (confirmation) => confirmation.owner !== owner,
          );
        })
        .map((owner) => {
          return delegateBuilder()
            .with('delegate', getAddress(faker.finance.ethereumAddress()))
            .with('delegator', owner)
            .with('safe', event.address)
            .build();
        });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length - confirmations.length,
      );
      expect(
        notificationsRepository.enqueueNotification.mock.calls,
      ).toStrictEqual(
        subscribers
          .filter((subscriber) => {
            return confirmations.every((confirmation) => {
              return confirmation.owner !== subscriber.subscriber;
            });
          })
          .map((subscriber) => {
            return [
              {
                token: subscriber.cloudMessagingToken,
                deviceUuid: subscriber.deviceUuid,
                notification: {
                  data: { ...event, type: 'MESSAGE_CONFIRMATION_REQUEST' },
                },
              },
            ];
          }),
      );
    });
  });

  // Note: many of the following are edge cases that can likely never or are highly unlikely to happen in practice
  // but we keep them here for completeness and to ensure the code behaves correctly in all scenarios
  describe('delegates', () => {
    it("should enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 and the delegate hasn't yet signed", async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const multisigTransaction = multisigTransactionBuilder()
        .with('safe', event.address)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const delegates = safe.owners.map((owner) => {
        return delegateBuilder()
          .with('delegate', getAddress(faker.finance.ethereumAddress()))
          .with('delegator', owner)
          .with('safe', event.address)
          .build();
      });
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, {
          token: subscriber.cloudMessagingToken,
          deviceUuid: subscriber.deviceUuid,
          notification: { data: { ...event, type: 'CONFIRMATION_REQUEST' } },
        });
      });
    });

    it('should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold of 1', async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', 1)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it('should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 but the delegate has signed', async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
      const confirmations = await Promise.all(
        subscribers.map((subscriber) => {
          return confirmationBuilder()
            .with('owner', subscriber.subscriber)
            .build();
        }),
      );
      const multisigTransaction = multisigTransactionBuilder()
        .with('confirmations', confirmations)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it("should only enqueue PENDING_MULTISIG_TRANSACTION event notifications for those that haven't signed", async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const owners = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ];
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with('owners', owners)
        .build();
      const subscribers = owners.map((owner) => ({
        subscriber: owner,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      }));
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const confirmations = await Promise.all(
        faker.helpers
          .arrayElements(owners, { min: 1, max: owners.length - 1 })
          .map((owner) => {
            return confirmationBuilder().with('owner', owner).build();
          }),
      );
      const delegates = owners
        .filter((owner) => {
          return confirmations.every(
            (confirmation) => confirmation.owner !== owner,
          );
        })
        .map((owner) => {
          return delegateBuilder()
            .with('delegate', getAddress(faker.finance.ethereumAddress()))
            .with('delegator', owner)
            .with('safe', event.address)
            .build();
        });
      const multisigTransaction = multisigTransactionBuilder()
        .with('safe', event.address)
        .with('confirmations', confirmations)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length - confirmations.length,
      );
      expect(
        notificationsRepository.enqueueNotification.mock.calls,
      ).toStrictEqual(
        subscribers
          .filter((subscriber) => {
            return confirmations.every((confirmation) => {
              return confirmation.owner !== subscriber.subscriber;
            });
          })
          .map((subscriber) => {
            return [
              {
                token: subscriber.cloudMessagingToken,
                deviceUuid: subscriber.deviceUuid,
                notification: {
                  data: { ...event, type: 'CONFIRMATION_REQUEST' },
                },
              },
            ];
          }),
      );
    });

    it("should enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 and the delegate hasn't yet signed", async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const delegates = safe.owners.map((owner) => {
        return delegateBuilder()
          .with('delegate', getAddress(faker.finance.ethereumAddress()))
          .with('delegator', owner)
          .with('safe', safe.address)
          .build();
      });
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          notificationsRepository.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, {
          token: subscriber.cloudMessagingToken,
          deviceUuid: subscriber.deviceUuid,
          notification: {
            data: { ...event, type: 'MESSAGE_CONFIRMATION_REQUEST' },
          },
        });
      });
    });

    it('should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold of 1', async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', 1)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it('should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 but the delegate has signed', async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
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
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it("should only enqueue MESSAGE_CONFIRMATION_REQUEST event notifications for those that haven't signed", async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const owners = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ];
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with('owners', owners)
        .build();
      const subscribers = owners.map((owner) => ({
        subscriber: owner,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      }));
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
      const confirmations = faker.helpers
        .arrayElements(owners, { min: 1, max: owners.length - 1 })
        .map((owner) => {
          return messageConfirmationBuilder().with('owner', owner).build();
        });
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .with('confirmations', confirmations)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length - confirmations.length,
      );
      expect(
        notificationsRepository.enqueueNotification.mock.calls,
      ).toStrictEqual(
        subscribers
          .filter((subscriber) => {
            return confirmations.every((confirmation) => {
              return confirmation.owner !== subscriber.subscriber;
            });
          })
          .map((subscriber) => {
            return [
              {
                token: subscriber.cloudMessagingToken,
                deviceUuid: subscriber.deviceUuid,
                notification: {
                  data: { ...event, type: 'MESSAGE_CONFIRMATION_REQUEST' },
                },
              },
            ];
          }),
      );
    });
  });

  describe('non-owners/delegates', () => {
    it("should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 and the subscriber hasn't yet signed", async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const multisigTransaction = multisigTransactionBuilder()
        .with('safe', event.address)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: faker.helpers.arrayElement([
            getAddress(faker.finance.ethereumAddress()),
            null,
          ]),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', []).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });

    it("should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 and the subscriber hasn't yet signed", async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: faker.helpers.arrayElement([
            getAddress(faker.finance.ethereumAddress()),
            null,
          ]),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', []).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const cb = getSubscriptionCallback(queuesApiService);
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);

      expect(
        notificationsRepository.enqueueNotification,
      ).not.toHaveBeenCalled();
    });
  });

  it('should enqueue CONFIRMATION_REQUEST event notifications accordingly for a mixture of subscribers: owners, delegates and non-owner/delegates', async () => {
    const event = pendingTransactionEventBuilder().build();
    const chain = chainBuilder().with('chainId', event.chainId).build();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const safeOwners = [
      signer.address,
      getAddress(faker.finance.ethereumAddress()),
      getAddress(faker.finance.ethereumAddress()),
      getAddress(faker.finance.ethereumAddress()),
    ];
    const ownerSubscriptions = [
      {
        subscriber: safeOwners[0],
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
      {
        subscriber: safeOwners[1],
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
    ];
    const delegateSubscriptions = [
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
    ];
    const delegateDelegators = {
      [delegateSubscriptions[0].subscriber]: safeOwners[2],
      [delegateSubscriptions[1].subscriber]: safeOwners[3],
    };
    const nonOwnerDelegateSubscriptions = [
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
      {
        subscriber: null,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
    ];
    const safe = safeBuilder()
      .with('address', event.address)
      .with('threshold', 3)
      .with(
        'owners',
        safeOwners.map((owners) => owners),
      )
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', event.address)
      .buildWithConfirmations({
        signers: [signer],
        chainId: chain.chainId,
        safe,
      });
    notificationsRepository.getSubscribersBySafe.mockResolvedValue([
      ...ownerSubscriptions,
      ...delegateSubscriptions,
      ...nonOwnerDelegateSubscriptions,
    ]);

    networkService.get.mockImplementation(({ url, networkRequest }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: rawify(chain),
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${event.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(safe),
        });
      } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
        const payloadDelegate = networkRequest?.params
          ?.delegate as `0x${string}`;
        const delegator = delegateDelegators[payloadDelegate];
        const results = delegator
          ? [
              delegateBuilder()
                .with('delegate', payloadDelegate)
                .with('delegator', delegator)
                .with('safe', safe.address)
                .build(),
            ]
          : [];
        return Promise.resolve({
          status: 200,
          data: rawify(pageBuilder().with('results', results).build()),
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(multisigTransaction),
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(event)) } as ConsumeMessage);

    expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
      3,
    );
    expect(notificationsRepository.enqueueNotification).toHaveBeenNthCalledWith(
      1,
      {
        token: ownerSubscriptions[1].cloudMessagingToken,
        deviceUuid: ownerSubscriptions[1].deviceUuid,
        notification: { data: { ...event, type: 'CONFIRMATION_REQUEST' } },
      },
    );
    expect(notificationsRepository.enqueueNotification).toHaveBeenNthCalledWith(
      2,
      {
        token: delegateSubscriptions[0].cloudMessagingToken,
        deviceUuid: delegateSubscriptions[0].deviceUuid,
        notification: { data: { ...event, type: 'CONFIRMATION_REQUEST' } },
      },
    );
    expect(notificationsRepository.enqueueNotification).toHaveBeenNthCalledWith(
      3,
      {
        token: delegateSubscriptions[1].cloudMessagingToken,
        deviceUuid: delegateSubscriptions[1].deviceUuid,
        notification: { data: { ...event, type: 'CONFIRMATION_REQUEST' } },
      },
    );
  });

  it('should enqueue MESSAGE_CONFIRMATION_REQUEST event notifications accordingly for a mixture of subscribers: owners, delegates and non-owner/delegates', async () => {
    const event = messageCreatedEventBuilder().build();
    const chain = chainBuilder().with('chainId', event.chainId).build();
    const safeOwners = [
      getAddress(faker.finance.ethereumAddress()),
      getAddress(faker.finance.ethereumAddress()),
      getAddress(faker.finance.ethereumAddress()),
      getAddress(faker.finance.ethereumAddress()),
    ];
    const ownerSubscriptions = [
      {
        subscriber: safeOwners[0],
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
      {
        subscriber: safeOwners[1],
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
    ];
    const delegateSubscriptions = [
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
    ];
    const delegateDelegators = {
      [delegateSubscriptions[0].subscriber]: safeOwners[2],
      [delegateSubscriptions[1].subscriber]: safeOwners[3],
    };
    const nonOwnerDelegateSubscriptions = [
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
      {
        subscriber: null,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      },
    ];
    const safe = safeBuilder()
      .with('address', event.address)
      .with('threshold', 3)
      .with(
        'owners',
        safeOwners.map((owner) => owner),
      )
      .build();
    const message = messageBuilder()
      .with('messageHash', event.messageHash as `0x${string}`)
      .with('confirmations', [
        messageConfirmationBuilder().with('owner', safeOwners[0]).build(),
      ])
      .build();
    notificationsRepository.getSubscribersBySafe.mockResolvedValue([
      ...ownerSubscriptions,
      ...delegateSubscriptions,
      ...nonOwnerDelegateSubscriptions,
    ]);

    networkService.get.mockImplementation(({ url, networkRequest }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: rawify(chain),
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${event.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(safe),
        });
      } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
        const payloadDelegate = networkRequest?.params
          ?.delegate as `0x${string}`;
        const delegator = delegateDelegators[payloadDelegate];
        const results = delegator
          ? [
              delegateBuilder()
                .with('delegate', payloadDelegate)
                .with('delegator', delegator)
                .with('safe', safe.address)
                .build(),
            ]
          : [];
        return Promise.resolve({
          status: 200,
          data: rawify(pageBuilder().with('results', results).build()),
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/messages/${event.messageHash}`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(message),
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(event)) } as ConsumeMessage);

    expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
      3,
    );
    expect(notificationsRepository.enqueueNotification).toHaveBeenNthCalledWith(
      1,
      {
        token: ownerSubscriptions[1].cloudMessagingToken,
        deviceUuid: ownerSubscriptions[1].deviceUuid,
        notification: {
          data: { ...event, type: 'MESSAGE_CONFIRMATION_REQUEST' },
        },
      },
    );
    expect(notificationsRepository.enqueueNotification).toHaveBeenNthCalledWith(
      2,
      {
        token: delegateSubscriptions[0].cloudMessagingToken,
        deviceUuid: delegateSubscriptions[0].deviceUuid,
        notification: {
          data: { ...event, type: 'MESSAGE_CONFIRMATION_REQUEST' },
        },
      },
    );
    expect(notificationsRepository.enqueueNotification).toHaveBeenNthCalledWith(
      3,
      {
        token: delegateSubscriptions[1].cloudMessagingToken,
        deviceUuid: delegateSubscriptions[1].deviceUuid,
        notification: {
          data: { ...event, type: 'MESSAGE_CONFIRMATION_REQUEST' },
        },
      },
    );
  });

  it('should not fail to send all notifications if one throws', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().with('threshold', 2).build();
    const deletedTransactionEvent = deletedMultisigTransactionEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const executedTransactionEvent = executedTransactionEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const incomingEtherEvent = incomingEtherEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const incomingTokenEvent = incomingTokenEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const moduleTransactionEvent = moduleTransactionEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const message = messageBuilder().with('safe', safe.address).build();
    const messageCreatedEvent = messageCreatedEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .with('messageHash', message.messageHash)
      .build();
    const multisigTransaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .build();
    const pendingTransactionEvent = pendingTransactionEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .with('safeTxHash', multisigTransaction.safeTxHash)
      .build();
    const events = [
      deletedTransactionEvent,
      executedTransactionEvent,
      incomingEtherEvent,
      incomingTokenEvent,
      moduleTransactionEvent,
      messageCreatedEvent,
      pendingTransactionEvent,
    ];
    const subscribers = faker.helpers.multiple(
      (_, i) => ({
        subscriber: safe.owners[i],
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      }),
      {
        count: safe.owners.length,
      },
    );
    const delegates = subscribers.map((subscriber) => {
      return delegateBuilder()
        .with('delegate', subscriber.subscriber)
        .with('safe', safe.address)
        .build();
    });
    notificationsRepository.getSubscribersBySafe.mockResolvedValue(subscribers);
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({
          data: rawify(chain),
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${safe.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(safe),
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${multisigTransaction.safeTxHash}/`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(multisigTransaction),
        });
      } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
        return Promise.resolve({
          status: 200,
          data: rawify(pageBuilder().with('results', delegates).build()),
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/messages/${message.messageHash}`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(message),
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });
    notificationsRepository.enqueueNotification
      .mockRejectedValueOnce(new Error('Error enqueueing notification'))
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('Other error'))
      .mockResolvedValue();

    const cb = getSubscriptionCallback(queuesApiService);
    for (const event of events) {
      await cb({
        content: Buffer.from(JSON.stringify(event)),
      } as ConsumeMessage);
    }

    expect(notificationsRepository.enqueueNotification).toHaveBeenCalledTimes(
      events.length,
    );
  });
});

// Due to mocking complexity, we split the tests into two suites
// Here we do not mock the NotificationsRepository, but the PushNotificationsApi
describe('Hook Events for Notifications (Unit) pt. 2', () => {
  let app: INestApplication<Server>;
  let pushNotificationsApi: jest.MockedObjectDeep<IPushNotificationsApi>;
  let notificationsRepository: jest.MockedObjectDeep<INotificationsRepositoryV2>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let configurationService: IConfigurationService;
  let safeConfigUrl: string;
  let queuesApiService: jest.MockedObjectDeep<IQueuesApiService>;

  async function initApp(): Promise<void> {
    const moduleFixture = await createTestModule({
      config: configuration,
      modules: [
        {
          originalModule: PushNotificationsApiModule,
          testModule: TestPushNotificationsApiModule,
        },
      ],
    });

    app = moduleFixture.createNestApplication();

    networkService = moduleFixture.get(NetworkService);
    pushNotificationsApi = moduleFixture.get(IPushNotificationsApi);
    configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    queuesApiService = moduleFixture.get(IQueuesApiService);
    notificationsRepository = moduleFixture.get(INotificationsRepositoryV2);

    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    await initApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should cleanup unregistered tokens', async () => {
    // Events that are notified "as is" for simplicity
    const event = faker.helpers.arrayElement([
      deletedMultisigTransactionEventBuilder().build(),
      executedTransactionEventBuilder().build(),
      moduleTransactionEventBuilder().build(),
    ]);
    const subscribers = faker.helpers.multiple(
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric({ length: 20 }),
      }),
      {
        count: { min: 2, max: 5 },
      },
    );
    const chain = chainBuilder().build();
    jest
      .spyOn(notificationsRepository, 'getSubscribersBySafe')
      .mockResolvedValue(subscribers);
    const deleteDeviceSpy = jest.spyOn(notificationsRepository, 'deleteDevice');
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: rawify(chain),
          status: 200,
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    pushNotificationsApi.enqueueNotification
      // Specific error regarding unregistered/stale tokens
      // @see https://firebase.google.com/docs/cloud-messaging/send-message#rest
      .mockRejectedValueOnce({
        code: 404,
        message: faker.lorem.words(),
        status: 'UNREGISTERED',
        details: [],
      })
      .mockResolvedValue();

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(event)) } as ConsumeMessage);

    expect(deleteDeviceSpy).toHaveBeenCalledTimes(1);
    expect(deleteDeviceSpy).toHaveBeenNthCalledWith(
      1,
      subscribers[0].deviceUuid,
    );
  });
});
