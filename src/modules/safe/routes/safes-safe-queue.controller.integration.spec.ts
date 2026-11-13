// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { SAFE_QUEUE_SERVICE_MAX_LIMIT } from '#/domain/common/constants';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import { singletonBuilder } from '#/modules/chains/domain/entities/__tests__/singleton.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import { contractBuilder } from '#/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import { safeQueueMultisigTransactionBuilder } from '#/modules/safe-queue/entities/__tests__/queue-multisig-transaction.builder';
import { safeQueueConfirmationBuilder } from '#/modules/safe-queue/entities/__tests__/safe-queue-confirmation.builder';
import { safeQueueMessageBuilder } from '#/modules/safe-queue/entities/__tests__/safe-queue-message.builder';
import type { SafeQueueConfirmation } from '#/modules/safe-queue/entities/multisig-transaction.entity';
import { rawify } from '#/validation/entities/raw.entity';

function toUnixSeconds(date: Date): string {
  return Math.floor(date.getTime() / 1000).toString();
}

describe('Safes Controller (Safe Queue Service enabled)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let dataDecoderUrl: string;
  let queueBaseUri: string;
  let networkService: MockedObject<INetworkService>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const queueEnabledConfig: typeof configuration = () => {
      const cfg = configuration();
      return { ...cfg, features: { ...cfg.features, safeQueueService: true } };
    };
    const moduleFixture = await createTestModule({
      config: queueEnabledConfig,
    });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    dataDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
    queueBaseUri = configurationService.getOrThrow('safeQueueService.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  describe('GET /v1/chains/:chainId/safes/:safeAddress/nonces', () => {
    function mockNonceUpstreams(args: {
      chain: Chain;
      safe: Safe;
      trustedTransactions: Array<unknown>;
      queuedTransactions: Array<unknown>;
    }): void {
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${args.chain.chainId}`:
            return Promise.resolve({ data: rawify(args.chain), status: 200 });
          case `${args.chain.transactionService}/api/v1/safes/${args.safe.address}`:
            return Promise.resolve({ data: rawify(args.safe), status: 200 });
          case `${args.chain.transactionService}/api/v2/safes/${args.safe.address}/multisig-transactions/`:
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', args.trustedTransactions)
                  .with('count', args.trustedTransactions.length)
                  .build(),
              ),
              status: 200,
            });
          case `${queueBaseUri}/api/v1/multisig-transactions/queue`:
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', args.queuedTransactions)
                  .with('count', args.queuedTransactions.length)
                  .with('next', null)
                  .with('previous', null)
                  .build(),
              ),
              status: 200,
            });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
    }

    it('recommends the last queued nonce + 1 when the queue is ahead of the Transaction Service', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder()
        .with('nonce', faker.number.int({ min: 0, max: 100 }))
        .build();
      const trustedNonce = safe.nonce + faker.number.int({ min: 0, max: 10 });
      const queuedNonce = trustedNonce + faker.number.int({ min: 1, max: 10 });
      const trustedTransaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', trustedNonce)
        .build();
      const queuedTransaction = safeQueueMultisigTransactionBuilder()
        .with('chainId', chain.chainId)
        .with('safe', safe.address)
        .with('nonce', queuedNonce)
        .with('txHash', null)
        .build();
      mockNonceUpstreams({
        chain,
        safe,
        trustedTransactions: [multisigTransactionToJson(trustedTransaction)],
        queuedTransactions: [queuedTransaction],
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/nonces`)
        .expect(200)
        .expect({
          currentNonce: safe.nonce,
          recommendedNonce: queuedNonce + 1,
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/multisig-transactions/queue`,
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              safes: `${safe.address}:${chain.chainId}`,
              nonceOrder: 'desc',
              limit: 1,
            }),
          }),
        }),
      );
    });

    it('recommends the last trusted nonce + 1 when the queue is empty', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder()
        .with('nonce', faker.number.int({ min: 0, max: 100 }))
        .build();
      const trustedTransaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce + faker.number.int({ min: 0, max: 10 }))
        .build();
      mockNonceUpstreams({
        chain,
        safe,
        trustedTransactions: [multisigTransactionToJson(trustedTransaction)],
        queuedTransactions: [],
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/nonces`)
        .expect(200)
        .expect({
          currentNonce: safe.nonce,
          recommendedNonce: trustedTransaction.nonce + 1,
        });
    });

    it('recommends the Safe nonce when it is higher than both the trusted and queued nonces', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder()
        .with('nonce', faker.number.int({ min: 50, max: 100 }))
        .build();
      const trustedTransaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', faker.number.int({ min: 0, max: safe.nonce - 2 }))
        .build();
      const queuedTransaction = safeQueueMultisigTransactionBuilder()
        .with('chainId', chain.chainId)
        .with('safe', safe.address)
        .with('nonce', faker.number.int({ min: 0, max: safe.nonce - 2 }))
        .with('txHash', null)
        .build();
      mockNonceUpstreams({
        chain,
        safe,
        trustedTransactions: [multisigTransactionToJson(trustedTransaction)],
        queuedTransactions: [queuedTransaction],
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/nonces`)
        .expect(200)
        .expect({
          currentNonce: safe.nonce,
          recommendedNonce: safe.nonce,
        });
    });
  });

  describe('GET /v1/chains/:chainId/safes/:safeAddress', () => {
    function mockSafeInfoUpstreams(args: {
      chain: Chain;
      safe: Safe;
      queuedTransactions: Array<unknown>;
      queuedMessages: Array<unknown>;
    }): void {
      const singletonInfo = contractBuilder()
        .with('address', args.safe.masterCopy)
        .build();
      const fallbackHandlerInfo = contractBuilder()
        .with('address', getAddress(args.safe.fallbackHandler))
        .build();
      const guardInfo = contractBuilder()
        .with('address', getAddress(args.safe.guard))
        .build();
      const singletons = [
        singletonBuilder().with('address', args.safe.masterCopy).build(),
      ];
      const emptyPage = pageBuilder().with('results', []).build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${args.chain.chainId}`:
            return Promise.resolve({ data: rawify(args.chain), status: 200 });
          case `${args.chain.transactionService}/api/v1/safes/${args.safe.address}`:
            return Promise.resolve({ data: rawify(args.safe), status: 200 });
          case `${args.chain.transactionService}/api/v1/about/singletons/`:
            return Promise.resolve({ data: rawify(singletons), status: 200 });
          case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
            return Promise.resolve({
              data: rawify(
                pageBuilder().with('results', [singletonInfo]).build(),
              ),
              status: 200,
            });
          case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
            return Promise.resolve({
              data: rawify(
                pageBuilder().with('results', [fallbackHandlerInfo]).build(),
              ),
              status: 200,
            });
          case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', [guardInfo]).build()),
              status: 200,
            });
          case `${args.chain.transactionService}/api/v1/safes/${args.safe.address}/transfers/`:
          case `${args.chain.transactionService}/api/v2/safes/${args.safe.address}/multisig-transactions/`:
          case `${args.chain.transactionService}/api/v1/safes/${args.safe.address}/module-transactions/`:
            return Promise.resolve({ data: rawify(emptyPage), status: 200 });
          case `${queueBaseUri}/api/v1/multisig-transactions/queue`:
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', args.queuedTransactions)
                  .with('count', args.queuedTransactions.length)
                  .with('next', null)
                  .with('previous', null)
                  .build(),
              ),
              status: 200,
            });
          case `${queueBaseUri}/api/v1/safes/${args.safe.address}/messages`:
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', args.queuedMessages)
                  .with('count', args.queuedMessages.length)
                  .with('next', null)
                  .with('previous', null)
                  .build(),
              ),
              status: 200,
            });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
    }

    it('computes txQueuedTag from the most recently modified queued transaction', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const latestModified = faker.date.recent();
      const modifiedDates = [
        faker.date.past({ refDate: latestModified }),
        latestModified,
        faker.date.past({ refDate: latestModified }),
      ];
      const queuedTransactions = modifiedDates.map((modified, index) =>
        safeQueueMultisigTransactionBuilder()
          .with('chainId', chain.chainId)
          .with('safe', safe.address)
          .with('nonce', safe.nonce + index)
          .with('txHash', null)
          .with('modified', modified)
          .build(),
      );
      mockSafeInfoUpstreams({
        chain,
        safe,
        queuedTransactions,
        queuedMessages: [],
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safe.address}`)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            txQueuedTag: toUnixSeconds(latestModified),
          }),
        );

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/multisig-transactions/queue`,
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              safes: `${safe.address}:${chain.chainId}`,
              nonceOrder: 'asc',
              limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
            }),
          }),
        }),
      );
    });

    it('returns a null txQueuedTag when the queue is empty', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      mockSafeInfoUpstreams({
        chain,
        safe,
        queuedTransactions: [],
        queuedMessages: [],
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safe.address}`)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({ txQueuedTag: null, messagesTag: null }),
        );
    });

    it('computes messagesTag from the latest modified queue message on the requested chain', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const latestModified = faker.date.recent();
      const sameChainMessages = [
        faker.date.past({ refDate: latestModified }),
        latestModified,
        faker.date.past({ refDate: latestModified }),
      ].map((modified) =>
        safeQueueMessageBuilder()
          .with('chainId', Number(chain.chainId))
          .with('safe', safe.address)
          .with('modified', modified)
          .build(),
      );
      const otherChainMessage = safeQueueMessageBuilder()
        .with('chainId', Number(chain.chainId) + 1)
        .with('safe', safe.address)
        .with('modified', faker.date.soon({ refDate: latestModified }))
        .build();
      mockSafeInfoUpstreams({
        chain,
        safe,
        queuedTransactions: [],
        queuedMessages: [...sameChainMessages, otherChainMessage],
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safe.address}`)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            messagesTag: toUnixSeconds(latestModified),
          }),
        );

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/safes/${safe.address}/messages`,
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              chainId: Number(chain.chainId),
            }),
          }),
        }),
      );
      expect(networkService.get).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v1/safes/${safe.address}/messages/`,
        }),
      );
    });
  });

  describe('GET /v1/safes', () => {
    it('counts queued and awaiting-confirmation transactions from the queue service', async () => {
      const chain = chainBuilder().build();
      const walletAddress: Address = getAddress(
        faker.finance.ethereumAddress(),
      );
      const safe = safeBuilder()
        .with('threshold', faker.number.int({ min: 2, max: 5 }))
        .build();
      const otherOwnerConfirmations = (
        count: number,
      ): Array<SafeQueueConfirmation> =>
        faker.helpers.multiple(() => safeQueueConfirmationBuilder().build(), {
          count,
        });
      const confirmationsPerTransaction: Array<Array<SafeQueueConfirmation>> = [
        [safeQueueConfirmationBuilder().with('owner', walletAddress).build()],
        otherOwnerConfirmations(safe.threshold),
        [],
        otherOwnerConfirmations(safe.threshold - 1),
      ];
      const expectedAwaitingConfirmation = 2;
      const queuedTransactions = confirmationsPerTransaction.map(
        (confirmations, index) =>
          safeQueueMultisigTransactionBuilder()
            .with('chainId', chain.chainId)
            .with('safe', safe.address)
            .with('nonce', safe.nonce + index)
            .with('txHash', null)
            .with('confirmations', confirmations)
            .build(),
      );
      const currency = faker.finance.currencyCode();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}/balances/`:
            return Promise.resolve({ data: rawify([]), status: 200 });
          case `${queueBaseUri}/api/v1/multisig-transactions/queue`:
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', queuedTransactions)
                  .with('count', queuedTransactions.length)
                  .with('next', null)
                  .with('previous', null)
                  .build(),
              ),
              status: 200,
            });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safe.address}&wallet_address=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              address: { value: safe.address },
              chainId: chain.chainId,
              threshold: safe.threshold,
              queued: queuedTransactions.length,
              awaitingConfirmation: expectedAwaitingConfirmation,
            },
          ]),
        );

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/multisig-transactions/queue`,
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              safes: `${safe.address}:${chain.chainId}`,
              nonceOrder: 'asc',
            }),
          }),
        }),
      );
      expect(networkService.get).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/safes/${safe.address}/multisig-transactions/`,
        }),
      );
    });
  });
});
