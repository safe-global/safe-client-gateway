// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { PrivateKeyAccount } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { SAFE_QUEUE_SERVICE_MAX_LIMIT } from '@/domain/common/constants';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import {
  toJson as multisigToJson,
  multisigTransactionBuilder,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { safeQueueMultisigTransactionBuilder } from '@/modules/safe-queue/entities/__tests__/queue-multisig-transaction.builder';
import type { SafeQueueMultisigTransactionEntity } from '@/modules/safe-queue/entities/multisig-transaction.entity';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { rawify } from '@/validation/entities/raw.entity';

function toQueueTransaction(
  transaction: MultisigTransaction,
  chainId: string,
): SafeQueueMultisigTransactionEntity {
  return safeQueueMultisigTransactionBuilder()
    .with('safeTxHash', transaction.safeTxHash)
    .with('chainId', chainId)
    .with('safe', transaction.safe)
    .with('nonce', transaction.nonce)
    .with('proposer', transaction.proposer)
    .with('to', transaction.to)
    .with('value', transaction.value)
    .with('data', transaction.data)
    .with('operation', transaction.operation)
    .with(
      'safeTxGas',
      transaction.safeTxGas === null ? null : transaction.safeTxGas.toString(),
    )
    .with(
      'baseGas',
      transaction.baseGas === null ? null : transaction.baseGas.toString(),
    )
    .with('gasPrice', transaction.gasPrice)
    .with('gasToken', transaction.gasToken)
    .with('refundReceiver', transaction.refundReceiver)
    .with('txHash', transaction.transactionHash)
    .with(
      'confirmations',
      (transaction.confirmations ?? []).flatMap((confirmation) => {
        return confirmation.signature === null
          ? []
          : [
              {
                owner: confirmation.owner,
                signature: confirmation.signature,
                signatureType: confirmation.signatureType,
                created: confirmation.submissionDate,
                modified: confirmation.submissionDate,
              },
            ];
      }),
    )
    .build();
}

describe('Multisig transactions - Safe queue service', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let queueBaseUri: string;
  let networkService: MockedObject<INetworkService>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const queueEnabledConfig: typeof configuration = () => {
      const cfg = configuration();
      return {
        ...cfg,
        features: {
          ...cfg.features,
          ethSign: true,
          safeQueueService: true,
        },
      };
    };

    const moduleFixture: TestingModule = await createTestModule({
      config: queueEnabledConfig,
      providers: [
        {
          provide: APP_FILTER,
          useClass: GlobalErrorFilter,
        },
      ],
    });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    queueBaseUri = configurationService.getOrThrow('safeQueueService.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  function getChainUrl(chain: Chain): string {
    return `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
  }

  function getSafeUrl(chain: Chain, safe: Safe): string {
    return `${chain.transactionService}/api/v1/safes/${safe.address}`;
  }

  function getMultisigTransactionsUrl(chain: Chain, safe: Safe): string {
    return `${chain.transactionService}/api/v2/safes/${safe.address}/multisig-transactions/`;
  }

  function getQueueBatchUrlPrefix(): string {
    return `${queueBaseUri}/api/v1/multisig-transactions/batch?`;
  }

  function getSafeAppsUrl(): string {
    return `${safeConfigUrl}/api/v1/safe-apps/`;
  }

  function getQueueUrl(): string {
    return `${queueBaseUri}/api/v1/multisig-transactions/queue`;
  }

  describe('GET /v1/chains/:chainId/safes/:safeAddress/multisig-transactions', () => {
    function mockUpstreams(args: {
      chain: Chain;
      safe: Safe;
      transactions: Array<MultisigTransaction>;
    }): void {
      networkService.get.mockImplementation(({ url }) => {
        if (url.startsWith(getQueueBatchUrlPrefix())) {
          return Promise.resolve({
            data: rawify(
              args.transactions.map((transaction) =>
                toQueueTransaction(transaction, args.chain.chainId),
              ),
            ),
            status: 200,
          });
        }
        switch (url) {
          case getChainUrl(args.chain):
            return Promise.resolve({ data: rawify(args.chain), status: 200 });
          case getSafeAppsUrl():
            return Promise.resolve({ data: rawify([]), status: 200 });
          case getSafeUrl(args.chain, args.safe):
            return Promise.resolve({ data: rawify(args.safe), status: 200 });
          case getMultisigTransactionsUrl(args.chain, args.safe):
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('count', args.transactions.length)
                  .with('next', null)
                  .with('previous', null)
                  .with('results', args.transactions.map(multisigToJson))
                  .build(),
              ),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
    }

    async function buildExecutedTransactions(args: {
      chain: Chain;
      safe: Safe;
      signers: Array<PrivateKeyAccount>;
    }): Promise<Array<MultisigTransaction>> {
      return await Promise.all(
        faker.helpers
          .multiple(() => faker.number.int({ max: args.safe.nonce - 1 }), {
            count: { min: 1, max: 3 },
          })
          .map((nonce) =>
            multisigTransactionBuilder()
              .with('safe', args.safe.address)
              .with('nonce', nonce)
              .with('data', null)
              .with('gasToken', null)
              .with('gasToken', null)
              .with('isExecuted', true)
              .with('isSuccessful', true)
              .buildWithConfirmations({
                chainId: args.chain.chainId,
                safe: args.safe,
                signers: args.signers,
              }),
          ),
      );
    }

    function buildSafeWithSigners(): {
      safe: Safe;
      signers: Array<PrivateKeyAccount>;
    } {
      const signers = faker.helpers.multiple(
        () => privateKeyToAccount(generatePrivateKey()),
        { count: { min: 1, max: 3 } },
      );
      const safe = safeBuilder()
        .with('nonce', faker.number.int({ min: 10, max: 1_000 }))
        .with(
          'owners',
          signers.map((signer) => signer.address),
        )
        .build();
      return { safe, signers };
    }

    it('requests only executed transactions from the TX service when executed is omitted', async () => {
      const chain = chainBuilder().build();
      const { safe, signers } = buildSafeWithSigners();
      const transactions = await buildExecutedTransactions({
        chain,
        safe,
        signers,
      });
      mockUpstreams({ chain, safe, transactions });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions`,
        )
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            results: transactions.map((transaction) =>
              expect.objectContaining({
                type: 'TRANSACTION',
                transaction: expect.objectContaining({
                  id: `multisig_${safe.address}_${transaction.safeTxHash}`,
                }),
              }),
            ),
          });
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: getMultisigTransactionsUrl(chain, safe),
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              safe: safe.address,
              executed: true,
              ordering: '-nonce',
              trusted: true,
            }),
          }),
        }),
      );
      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(getQueueBatchUrlPrefix()),
        }),
      );
    });

    it('requests only executed transactions from the TX service when executed=false', async () => {
      const chain = chainBuilder().build();
      const { safe, signers } = buildSafeWithSigners();
      const transactions = await buildExecutedTransactions({
        chain,
        safe,
        signers,
      });
      mockUpstreams({ chain, safe, transactions });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions`,
        )
        .query({ executed: false })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            results: transactions.map((transaction) =>
              expect.objectContaining({
                type: 'TRANSACTION',
                transaction: expect.objectContaining({
                  id: `multisig_${safe.address}_${transaction.safeTxHash}`,
                  txStatus: 'SUCCESS',
                }),
              }),
            ),
          });
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: getMultisigTransactionsUrl(chain, safe),
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              safe: safe.address,
              executed: true,
            }),
          }),
        }),
      );
    });

    it('returns the executed transactions from the TX service when executed=true', async () => {
      const chain = chainBuilder().build();
      const { safe, signers } = buildSafeWithSigners();
      const transactions = await buildExecutedTransactions({
        chain,
        safe,
        signers,
      });
      mockUpstreams({ chain, safe, transactions });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions`,
        )
        .query({ executed: true })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            results: transactions.map((transaction) =>
              expect.objectContaining({
                type: 'TRANSACTION',
                transaction: expect.objectContaining({
                  id: `multisig_${safe.address}_${transaction.safeTxHash}`,
                  txStatus: 'SUCCESS',
                }),
              }),
            ),
          });
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: getMultisigTransactionsUrl(chain, safe),
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              safe: safe.address,
              executed: true,
            }),
          }),
        }),
      );
    });
  });

  describe('GET /v1/chains/:chainId/transactions/:id rejectors', () => {
    it('reads the rejection of a pending transaction from the queue service', async () => {
      const chain = chainBuilder().build();
      const signers = faker.helpers.multiple(
        () => privateKeyToAccount(generatePrivateKey()),
        { count: { min: 2, max: 3 } },
      );
      const safe = safeBuilder()
        .with('nonce', faker.number.int({ min: 0, max: 1_000 }))
        .with(
          'owners',
          signers.map((signer) => signer.address),
        )
        .build();
      const nonce = faker.number.int({ min: safe.nonce, max: safe.nonce + 5 });
      const pendingTransaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', nonce)
        .with('data', null)
        .with('gasToken', null)
        .with('operation', Operation.CALL)
        .with('transactionHash', null)
        .with('isExecuted', false)
        .with('isSuccessful', null)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signers[0]],
        });
      const rejectionTransaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', nonce)
        .with('to', safe.address)
        .with('value', '0')
        .with('data', null)
        .with('gasToken', null)
        .with('operation', Operation.CALL)
        .with('transactionHash', null)
        .with('isExecuted', false)
        .with('isSuccessful', null)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: signers.slice(1),
        });
      const otherNonceTransaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', nonce + 1)
        .with('to', safe.address)
        .with('value', '0')
        .with('data', null)
        .with('gasToken', null)
        .with('operation', Operation.CALL)
        .with('transactionHash', null)
        .with('isExecuted', false)
        .with('isSuccessful', null)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signers[0]],
        });
      const queueTransactions = [
        pendingTransaction,
        rejectionTransaction,
        otherNonceTransaction,
      ].map((transaction) => toQueueTransaction(transaction, chain.chainId));
      const queuePage = pageBuilder()
        .with('count', queueTransactions.length)
        .with('next', null)
        .with('previous', null)
        .with('results', queueTransactions)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl(chain):
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getSafeAppsUrl():
            return Promise.resolve({ data: rawify([]), status: 200 });
          case getSafeUrl(chain, safe):
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case `${queueBaseUri}/api/v1/multisig-transactions/${pendingTransaction.safeTxHash}`:
            return Promise.resolve({
              data: rawify(
                toQueueTransaction(pendingTransaction, chain.chainId),
              ),
              status: 200,
            });
          case getQueueUrl():
            return Promise.resolve({ data: rawify(queuePage), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${pendingTransaction.safeTxHash}`,
        )
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            txId: `multisig_${safe.address}_${pendingTransaction.safeTxHash}`,
            detailedExecutionInfo: {
              type: 'MULTISIG',
              nonce,
              safeTxHash: pendingTransaction.safeTxHash,
              rejectors: (rejectionTransaction.confirmations ?? []).map(
                (confirmation) =>
                  expect.objectContaining({ value: confirmation.owner }),
              ),
            },
          });
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: getQueueUrl(),
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              safes: `${safe.address}:${chain.chainId}`,
              nonceOrder: 'asc',
              limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
            }),
          }),
        }),
      );
      expect(networkService.get).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: getMultisigTransactionsUrl(chain, safe),
        }),
      );
    });
  });
});
