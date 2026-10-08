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
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { SAFE_QUEUE_SERVICE_MAX_LIMIT } from '@/domain/common/constants';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getSignature } from '@/domain/common/utils/__tests__/signatures.builder';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import {
  toJson as multisigToJson,
  multisigTransactionBuilder,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { safeQueueMultisigTransactionBuilder } from '@/modules/safe-queue/entities/__tests__/queue-multisig-transaction.builder';
import type { SafeQueueMultisigTransactionEntity } from '@/modules/safe-queue/entities/multisig-transaction.entity';
import { tokenBuilder } from '@/modules/tokens/domain/__tests__/token.builder';
import { addConfirmationDtoBuilder } from '@/modules/transactions/routes/__tests__/entities/add-confirmation.dto.builder';
import { proposeTransactionDtoBuilder } from '@/modules/transactions/routes/entities/__tests__/propose-transaction.dto.builder';
import type { ProposeTransactionDto } from '@/modules/transactions/routes/entities/propose-transaction.dto.entity';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { rawify } from '@/validation/entities/raw.entity';

const NON_ETH_SIGN_SIGNATURE_TYPES = [
  SignatureType.Eoa,
  SignatureType.ContractSignature,
  SignatureType.ApprovedHash,
];

async function buildSignedProposal(args: {
  chainId: string;
  safe: Safe;
  nonce: number;
  signer: PrivateKeyAccount;
  signatureType: SignatureType;
}): Promise<{
  proposal: ProposeTransactionDto;
  transaction: SafeQueueMultisigTransactionEntity;
}> {
  const proposalBuilder = proposeTransactionDtoBuilder()
    .with('nonce', args.nonce.toString())
    .with('operation', Operation.CALL)
    .with('data', null)
    .with('origin', null);
  const draft = proposalBuilder.build();
  const safeTxHash = getSafeTxHash({
    chainId: args.chainId,
    safe: args.safe,
    transaction: {
      ...draft,
      nonce: args.nonce,
      safeTxGas: Number(draft.safeTxGas),
      baseGas: Number(draft.baseGas),
    },
  });
  const signature = await getSignature({
    signer: args.signer,
    hash: safeTxHash,
    signatureType: args.signatureType,
  });
  const proposal = proposalBuilder
    .with('safeTxHash', safeTxHash)
    .with('sender', args.signer.address)
    .with('signature', signature)
    .build();
  const transaction = safeQueueMultisigTransactionBuilder()
    .with('safeTxHash', safeTxHash)
    .with('chainId', args.chainId)
    .with('safe', args.safe.address)
    .with('nonce', args.nonce)
    .with('proposer', args.signer.address)
    .with('to', draft.to)
    .with('value', draft.value)
    .with('data', draft.data)
    .with('operation', draft.operation)
    .with('safeTxGas', draft.safeTxGas)
    .with('baseGas', draft.baseGas)
    .with('gasPrice', draft.gasPrice)
    .with('gasToken', draft.gasToken)
    .with('refundReceiver', draft.refundReceiver)
    .with('txHash', null)
    .with('confirmations', [
      {
        owner: args.signer.address,
        signature,
        signatureType: args.signatureType,
        created: faker.date.recent(),
        modified: faker.date.recent(),
      },
    ])
    .build();
  return { proposal, transaction };
}

describe('Transactions Controller - Safe Queue Service', () => {
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
          safeQueueService: true,
          ethSign: false,
        },
      };
    };

    const moduleFixture: TestingModule = await createTestModule({
      config: queueEnabledConfig,
      providers: [{ provide: APP_FILTER, useClass: GlobalErrorFilter }],
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

  function notFoundError(url: string): NetworkResponseError {
    return new NetworkResponseError(
      new URL(url),
      new Response(null, { status: 404 }),
      { detail: faker.lorem.sentence() },
    );
  }

  describe('GET queued transactions', () => {
    it('serves the queue from the Safe Queue Service', async () => {
      const chain = chainBuilder().build();
      const signer = privateKeyToAccount(generatePrivateKey());
      const safe = safeBuilder()
        .with('owners', [signer.address])
        .with('threshold', 1)
        .build();
      const signatureType = faker.helpers.arrayElement(
        NON_ETH_SIGN_SIGNATURE_TYPES,
      );
      const { transaction: next } = await buildSignedProposal({
        chainId: chain.chainId,
        safe,
        nonce: safe.nonce,
        signer,
        signatureType,
      });
      const { transaction: queued } = await buildSignedProposal({
        chainId: chain.chainId,
        safe,
        nonce: safe.nonce + 1,
        signer,
        signatureType,
      });
      const queuePage = pageBuilder()
        .with('count', 2)
        .with('next', null)
        .with('previous', null)
        .with('results', [next, queued])
        .build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getQueueUrl = `${queueBaseUri}/api/v1/multisig-transactions/queue`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getQueueUrl:
            return Promise.resolve({ data: rawify(queuePage), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/queued`,
        )
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            count: 4,
            next: null,
            previous: null,
            results: [
              { type: 'LABEL', label: 'Next' },
              {
                type: 'TRANSACTION',
                transaction: expect.objectContaining({
                  id: `multisig_${safe.address}_${next.safeTxHash}`,
                  txStatus: 'AWAITING_EXECUTION',
                }),
                conflictType: 'None',
              },
              { type: 'LABEL', label: 'Queued' },
              {
                type: 'TRANSACTION',
                transaction: expect.objectContaining({
                  id: `multisig_${safe.address}_${queued.safeTxHash}`,
                }),
                conflictType: 'None',
              },
            ],
          });
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: getQueueUrl,
          networkRequest: expect.objectContaining({
            params: {
              safes: `${safe.address}:${chain.chainId}`,
              nonceOrder: 'asc',
              limit: 21,
              offset: 0,
            },
          }),
        }),
      );
      expect(networkService.get).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/safes/${safe.address}/multisig-transactions/`,
        }),
      );
    });

    it('caps a large cursor limit at the Safe Queue Service maximum', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const queuePage = pageBuilder()
        .with('count', 0)
        .with('next', null)
        .with('previous', null)
        .with('results', [])
        .build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getQueueUrl = `${queueBaseUri}/api/v1/multisig-transactions/queue`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getQueueUrl:
            return Promise.resolve({ data: rawify(queuePage), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/queued?cursor=limit%3D150%26offset%3D0`,
        )
        .expect(200)
        .expect({ count: 0, next: null, previous: null, results: [] });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: getQueueUrl,
          networkRequest: expect.objectContaining({
            params: {
              safes: `${safe.address}:${chain.chainId}`,
              nonceOrder: 'asc',
              limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
              offset: 0,
            },
          }),
        }),
      );
    });
  });

  describe('POST propose transaction', () => {
    it('proposes to the Safe Queue Service when no proposal exists yet', async () => {
      const chain = chainBuilder().build();
      const signer = privateKeyToAccount(generatePrivateKey());
      const safe = safeBuilder()
        .with('owners', [signer.address])
        .with('threshold', 1)
        .build();
      const { proposal, transaction } = await buildSignedProposal({
        chainId: chain.chainId,
        safe,
        nonce: safe.nonce,
        signer,
        signatureType: faker.helpers.arrayElement(NON_ETH_SIGN_SIGNATURE_TYPES),
      });
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getQueueTransactionUrl = `${queueBaseUri}/api/v1/multisig-transactions/${transaction.safeTxHash}`;
      const gasToken = tokenBuilder().build();
      const getGasTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      const getQueueUrl = `${queueBaseUri}/api/v1/multisig-transactions/queue`;
      const proposeUrl = `${queueBaseUri}/api/v1/multisig-transactions`;
      const queuePage = pageBuilder().with('results', [transaction]).build();
      let isProposed = false;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getQueueTransactionUrl:
            return isProposed
              ? Promise.resolve({
                  data: rawify(transaction),
                  status: 200,
                })
              : Promise.reject(notFoundError(url));
          case getGasTokenUrl:
            return Promise.resolve({ data: rawify(gasToken), status: 200 });
          case getQueueUrl:
            return Promise.resolve({ data: rawify(queuePage), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === proposeUrl) {
          isProposed = true;
          return Promise.resolve({
            data: rawify(transaction),
            status: 201,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposal)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            safeAddress: safe.address,
            txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
            txStatus: 'AWAITING_EXECUTION',
            txHash: null,
            detailedExecutionInfo: {
              type: 'MULTISIG',
              nonce: transaction.nonce,
              safeTxHash: transaction.safeTxHash,
            },
          }),
        );

      expect(networkService.post).toHaveBeenCalledWith(
        expect.objectContaining({
          url: proposeUrl,
          data: expect.objectContaining({
            chainId: Number(chain.chainId),
            safe: safe.address,
            nonce: transaction.nonce,
            signatures: [proposal.signature],
          }),
        }),
      );
      expect(networkService.get).toHaveBeenCalledWith({
        url: getQueueTransactionUrl,
        networkRequest: {
          circuitBreaker: expect.anything(),
        },
      });
      expect(networkService.get).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/multisig-transactions/${transaction.safeTxHash}/`,
        }),
      );
      expect(networkService.post).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/safes/${safe.address}/multisig-transactions/`,
        }),
      );
    });

    it('accepts an eth_sign signature already on the existing proposal read from the Safe Queue Service', async () => {
      const chain = chainBuilder().build();
      const signer = privateKeyToAccount(generatePrivateKey());
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const { proposal, transaction } = await buildSignedProposal({
        chainId: chain.chainId,
        safe,
        nonce: safe.nonce,
        signer,
        signatureType: SignatureType.EthSign,
      });
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getQueueTransactionUrl = `${queueBaseUri}/api/v1/multisig-transactions/${transaction.safeTxHash}`;
      const gasToken = tokenBuilder().build();
      const getGasTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      const getQueueUrl = `${queueBaseUri}/api/v1/multisig-transactions/queue`;
      const proposeUrl = `${queueBaseUri}/api/v1/multisig-transactions`;
      const queuePage = pageBuilder().with('results', [transaction]).build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getQueueTransactionUrl:
            return Promise.resolve({
              data: rawify(transaction),
              status: 200,
            });
          case getGasTokenUrl:
            return Promise.resolve({ data: rawify(gasToken), status: 200 });
          case getQueueUrl:
            return Promise.resolve({ data: rawify(queuePage), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === proposeUrl) {
          return Promise.resolve({
            data: rawify(transaction),
            status: 201,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposal)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            safeAddress: safe.address,
            txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
            txHash: null,
          }),
        );

      expect(networkService.get).toHaveBeenCalledWith({
        url: getQueueTransactionUrl,
        networkRequest: {
          circuitBreaker: expect.anything(),
        },
      });
      expect(networkService.post).toHaveBeenCalledWith(
        expect.objectContaining({ url: proposeUrl }),
      );
      expect(networkService.get).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/multisig-transactions/${transaction.safeTxHash}/`,
        }),
      );
    });
  });

  describe('POST add confirmation', () => {
    it('posts the confirmation to the Safe Queue Service', async () => {
      const chain = chainBuilder().build();
      const proposer = privateKeyToAccount(generatePrivateKey());
      const confirmer = privateKeyToAccount(generatePrivateKey());
      const safe = safeBuilder()
        .with('owners', [proposer.address, confirmer.address])
        .with('threshold', 2)
        .build();
      const { transaction } = await buildSignedProposal({
        chainId: chain.chainId,
        safe,
        nonce: safe.nonce,
        signer: proposer,
        signatureType: faker.helpers.arrayElement(NON_ETH_SIGN_SIGNATURE_TYPES),
      });
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with(
          'signature',
          await getSignature({
            signer: confirmer,
            hash: transaction.safeTxHash,
            signatureType: SignatureType.Eoa,
          }),
        )
        .build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getQueueTransactionUrl = `${queueBaseUri}/api/v1/multisig-transactions/${transaction.safeTxHash}`;
      const gasToken = tokenBuilder().build();
      const getGasTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      const getQueueUrl = `${queueBaseUri}/api/v1/multisig-transactions/queue`;
      const postConfirmationUrl = `${queueBaseUri}/api/v1/multisig-transactions/${transaction.safeTxHash}/signatures`;
      const queuePage = pageBuilder().with('results', [transaction]).build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getQueueTransactionUrl:
            return Promise.resolve({
              data: rawify(transaction),
              status: 200,
            });
          case getGasTokenUrl:
            return Promise.resolve({ data: rawify(gasToken), status: 200 });
          case getQueueUrl:
            return Promise.resolve({ data: rawify(queuePage), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === postConfirmationUrl) {
          return Promise.resolve({ data: rawify({}), status: 201 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
        )
        .send(addConfirmationDto)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            safeAddress: safe.address,
            txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
            txHash: null,
          }),
        );

      expect(networkService.post).toHaveBeenCalledWith(
        expect.objectContaining({
          url: postConfirmationUrl,
          data: { signatures: [addConfirmationDto.signature] },
        }),
      );
      expect(networkService.post).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/confirmations/`,
        }),
      );
    });
  });

  describe('DELETE transaction', () => {
    it('deletes the transaction from the Safe Queue Service', async () => {
      const chain = chainBuilder().build();
      const signer = privateKeyToAccount(generatePrivateKey());
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const { transaction } = await buildSignedProposal({
        chainId: chain.chainId,
        safe,
        nonce: safe.nonce,
        signer,
        signatureType: faker.helpers.arrayElement(NON_ETH_SIGN_SIGNATURE_TYPES),
      });
      const signature = faker.string.hexadecimal({ length: 130 });
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getQueueTransactionUrl = `${queueBaseUri}/api/v1/multisig-transactions/${transaction.safeTxHash}`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getQueueTransactionUrl:
            return Promise.resolve({
              data: rawify(transaction),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      networkService.delete.mockImplementation(({ url }) => {
        if (url === getQueueTransactionUrl) {
          return Promise.resolve({ data: rawify({}), status: 204 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}`,
        )
        .send({ signature })
        .expect(200);

      expect(networkService.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          url: getQueueTransactionUrl,
          data: { signature },
        }),
      );
      expect(networkService.delete).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/multisig-transactions/${transaction.safeTxHash}`,
        }),
      );
    });
  });

  describe('GET transaction by id', () => {
    it('serves a pending transaction from the Safe Queue Service', async () => {
      const chain = chainBuilder().build();
      const signer = privateKeyToAccount(generatePrivateKey());
      const safe = safeBuilder()
        .with('owners', [
          signer.address,
          privateKeyToAccount(generatePrivateKey()).address,
        ])
        .with('threshold', 2)
        .build();
      const { transaction } = await buildSignedProposal({
        chainId: chain.chainId,
        safe,
        nonce: safe.nonce,
        signer,
        signatureType: faker.helpers.arrayElement(NON_ETH_SIGN_SIGNATURE_TYPES),
      });
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getQueueTransactionUrl = `${queueBaseUri}/api/v1/multisig-transactions/${transaction.safeTxHash}`;
      const gasToken = tokenBuilder().build();
      const getGasTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      const getQueueUrl = `${queueBaseUri}/api/v1/multisig-transactions/queue`;
      const queuePage = pageBuilder().with('results', [transaction]).build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getQueueTransactionUrl:
            return Promise.resolve({
              data: rawify(transaction),
              status: 200,
            });
          case getGasTokenUrl:
            return Promise.resolve({ data: rawify(gasToken), status: 200 });
          case getQueueUrl:
            return Promise.resolve({ data: rawify(queuePage), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${transaction.safeTxHash}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            safeAddress: safe.address,
            txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
            txStatus: 'AWAITING_CONFIRMATIONS',
            txHash: null,
            executedAt: null,
            detailedExecutionInfo: {
              type: 'MULTISIG',
              nonce: transaction.nonce,
              safeTxHash: transaction.safeTxHash,
              confirmationsRequired: safe.threshold,
              confirmations: [
                {
                  signer: expect.objectContaining({ value: signer.address }),
                  signature: transaction.confirmations[0].signature,
                  submittedAt: transaction.confirmations[0].created.getTime(),
                },
              ],
            },
          }),
        );

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({ url: getQueueTransactionUrl }),
      );
      expect(networkService.get).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/multisig-transactions/${transaction.safeTxHash}/`,
        }),
      );
    });

    it('serves an executed transaction from the Transaction Service', async () => {
      const chain = chainBuilder().build();
      const signer = privateKeyToAccount(generatePrivateKey());
      const safe = safeBuilder()
        .with('owners', [signer.address])
        .with('nonce', faker.number.int({ min: 1, max: 100 }))
        .build();
      const executionDate = faker.date.recent();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce - 1)
        .with('operation', Operation.CALL)
        .with('data', null)
        .with('origin', null)
        .with('isExecuted', true)
        .with('isSuccessful', true)
        .with('executionDate', executionDate)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signer],
          signatureType: faker.helpers.arrayElement(
            NON_ETH_SIGN_SIGNATURE_TYPES,
          ),
        });
      const queueTransaction = safeQueueMultisigTransactionBuilder()
        .with('safeTxHash', transaction.safeTxHash)
        .with('chainId', chain.chainId)
        .with('safe', safe.address)
        .with('txHash', transaction.transactionHash)
        .build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getQueueTransactionUrl = `${queueBaseUri}/api/v1/multisig-transactions/${transaction.safeTxHash}`;
      const getTxServiceTransactionUrl = `${chain.transactionService}/api/v2/multisig-transactions/${transaction.safeTxHash}/`;
      const gasToken = tokenBuilder().build();
      const getGasTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      const getTxServiceTransactionsUrl = `${chain.transactionService}/api/v2/safes/${safe.address}/multisig-transactions/`;
      const emptyPage = pageBuilder()
        .with('count', 0)
        .with('next', null)
        .with('previous', null)
        .with('results', [])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getQueueTransactionUrl:
            return Promise.resolve({
              data: rawify(queueTransaction),
              status: 200,
            });
          case getTxServiceTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getGasTokenUrl:
            return Promise.resolve({ data: rawify(gasToken), status: 200 });
          case getTxServiceTransactionsUrl:
            return Promise.resolve({ data: rawify(emptyPage), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${transaction.safeTxHash}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            safeAddress: safe.address,
            txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
            txStatus: 'SUCCESS',
            txHash: transaction.transactionHash,
            executedAt: executionDate.getTime(),
            detailedExecutionInfo: {
              type: 'MULTISIG',
              nonce: transaction.nonce,
              safeTxHash: transaction.safeTxHash,
            },
          }),
        );

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({ url: getQueueTransactionUrl }),
      );
      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({ url: getTxServiceTransactionUrl }),
      );
    });
  });
});
