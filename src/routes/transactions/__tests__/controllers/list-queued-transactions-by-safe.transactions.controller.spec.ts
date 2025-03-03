import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestIdentityApiModule } from '@/datasources/locking-api/__tests__/test.identity-api.module';
import { IdentityApiModule } from '@/datasources/locking-api/identity-api.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import {
  toJson as multisigToJson,
  multisigTransactionBuilder,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { Server } from 'net';
import request from 'supertest';
import { getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

describe('List queued transactions by Safe - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  async function initApp(config: typeof configuration): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    })
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(IdentityApiModule)
      .useModule(TestIdentityApiModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();

    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      features: {
        ...baseConfiguration.features,
        ethSign: true,
      },
    });

    await initApp(testConfiguration);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Failure: data page validation fails', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const page = pageBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify({ ...page, count: faker.word.words() }),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safe.address}/transactions/queued`)
      .expect(502)
      .expect({ statusCode: 502, message: 'Bad gateway' });
  });

  it('should get a transactions queue with labels and conflict headers', async () => {
    const chainId = faker.string.numeric();
    const chainResponse = chainBuilder().build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safeResponse = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', 1)
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const contractResponse = contractBuilder().build();
    const getTransaction = (nonce: number): MultisigTransaction => {
      const transaction = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('isExecuted', false)
        .with('nonce', nonce)
        .with('dataDecoded', null)
        .with('confirmations', [])
        .build();
      transaction.safeTxHash = getSafeTxHash({
        transaction,
        safe: safeResponse,
        chainId,
      });
      return transaction;
    };
    const nonce1 = getTransaction(1);
    const nonce2 = getTransaction(2);
    const nonce3 = getTransaction(3);
    const nonce4 = getTransaction(4);
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce2) as MultisigTransaction,
      multisigToJson(nonce2) as MultisigTransaction,
      multisigToJson(nonce3) as MultisigTransaction,
      multisigToJson(nonce4) as MultisigTransaction,
    ];

    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chainResponse), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify({
            count: 6,
            next: null,
            previous: null,
            results: transactions,
          }),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safeResponse), status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: rawify(safeAppsResponse), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: rawify(contractResponse), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/queued`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual({
          count: 10,
          next: null,
          previous: null,
          results: [
            {
              type: 'LABEL',
              label: 'Next',
            },
            {
              type: 'CONFLICT_HEADER',
              nonce: 1,
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[0].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[1].safeTxHash}`,
              }),
              conflictType: 'End',
            },
            {
              type: 'LABEL',
              label: 'Queued',
            },
            {
              type: 'CONFLICT_HEADER',
              nonce: 2,
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[2].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[3].safeTxHash}`,
              }),
              conflictType: 'End',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[4].safeTxHash}`,
              }),
              conflictType: 'None',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[5].safeTxHash}`,
              }),
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('should get a transactions queue with labels and conflict headers for a multi-page queue', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainResponse = chainBuilder().build();
    const contractResponse = contractBuilder().build();
    const safeResponse = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', 1)
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const getTransaction = (nonce: number): MultisigTransaction => {
      const transaction = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('isExecuted', false)
        .with('nonce', nonce)
        .with('dataDecoded', null)
        .with('confirmations', [])
        .build();
      transaction.safeTxHash = getSafeTxHash({
        transaction,
        safe: safeResponse,
        chainId,
      });
      return transaction;
    };
    const nonce1 = getTransaction(1);
    const nonce2 = getTransaction(2);
    const nonce3 = getTransaction(3);
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce2) as MultisigTransaction,
      multisigToJson(nonce2) as MultisigTransaction,
      multisigToJson(nonce3) as MultisigTransaction,
      multisigToJson(nonce3) as MultisigTransaction,
    ];
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chainResponse), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify({
            count: 20,
            next: `${faker.internet.url({
              appendSlash: false,
            })}/?limit=10&offset=50`,
            previous: `${faker.internet.url({
              appendSlash: false,
            })}/?limit=10&offset=30`,
            results: transactions,
          }),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safeResponse), status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: rawify(safeAppsResponse), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: rawify(contractResponse), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/queued/?cursor=limit%3D10%26offset%3D2`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual({
          count: 10,
          next: expect.stringContaining('?cursor='),
          previous: expect.stringContaining('?cursor='),
          results: [
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[0].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[1].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[2].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[3].safeTxHash}`,
              }),
              conflictType: 'End',
            },
            {
              type: 'LABEL',
              label: 'Queued',
            },
            {
              type: 'CONFLICT_HEADER',
              nonce: 2,
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[4].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[5].safeTxHash}`,
              }),
              conflictType: 'End',
            },
            {
              type: 'CONFLICT_HEADER',
              nonce: 3,
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[6].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
          ],
        });
      });
  });

  it('should get an "untrusted" queue', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainResponse = chainBuilder().build();
    const contractResponse = contractBuilder().build();
    const safeResponse = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', 1)
      .build();
    const safeAppsResponse = [safeAppBuilder().build()];
    const getTransaction = (nonce: number): MultisigTransaction => {
      const transaction = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('isExecuted', false)
        .with('nonce', nonce)
        .with('dataDecoded', null)
        .with('confirmations', [])
        .build();
      transaction.safeTxHash = getSafeTxHash({
        transaction,
        safe: safeResponse,
        chainId,
      });
      return transaction;
    };
    const nonce1 = getTransaction(1);
    const nonce2 = getTransaction(2);
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce2) as MultisigTransaction,
    ];
    networkService.get.mockImplementation(({ url, networkRequest }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chainResponse), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        if (!networkRequest?.params) {
          return Promise.reject('Query params not found');
        }
        expect(networkRequest.params.trusted).toBe(false);

        return Promise.resolve({
          data: rawify({
            count: 2,
            next: null,
            previous: null,
            results: transactions,
          }),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safeResponse), status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: rawify(safeAppsResponse), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: rawify(contractResponse), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/queued/?trusted=false`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual({
          count: 4,
          next: null,
          previous: null,
          results: [
            {
              label: 'Next',
              type: 'LABEL',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[0].safeTxHash}`,
              }),
              conflictType: 'None',
            },
            {
              label: 'Queued',
              type: 'LABEL',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[1].safeTxHash}`,
              }),
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('should return a 502 if there is a safeTxHash mismatch', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().with('nonce', 1).build();
    const getTransaction = (nonce: number): MultisigTransaction => {
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', nonce)
        .with('dataDecoded', null)
        .with('confirmations', [])
        .build();
      transaction.safeTxHash = getSafeTxHash({
        transaction,
        safe,
        chainId: chain.chainId,
      });
      return transaction;
    };
    const nonce1 = getTransaction(1);
    const nonce2 = getTransaction(2);
    nonce1.safeTxHash = faker.string.hexadecimal({
      length: 64,
    }) as `0x${string}`;
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce2) as MultisigTransaction,
    ];
    const contract = contractBuilder().build();

    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(pageBuilder().with('results', transactions).build()),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: rawify([]), status: 200 });
      }
      if (url.startsWith(getContractUrlPattern)) {
        return Promise.resolve({
          data: rawify(contract),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/queued`,
      )
      .expect(502)
      .expect({
        message: 'Invalid safeTxHash',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });

  it('should return a 502 if confirmations contain duplicate owners', async () => {
    const chain = chainBuilder().build();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const safe = safeBuilder().with('owners', [signer.address]).build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: chain.chainId,
        safe,
        signers: [signer],
      });
    const duplicateOwnersMultisigTransaction =
      await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signer, signer],
        });
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(multisigTransaction) as MultisigTransaction,
      multisigToJson(duplicateOwnersMultisigTransaction) as MultisigTransaction,
      multisigToJson(multisigTransaction) as MultisigTransaction,
    ];
    const contract = contractBuilder().build();

    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(pageBuilder().with('results', transactions).build()),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: rawify([]), status: 200 });
      }
      if (url.startsWith(getContractUrlPattern)) {
        return Promise.resolve({
          data: rawify(contract),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/queued`,
      )
      .expect(502)
      .expect({
        message: 'Duplicate owners in confirmations',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });

  it('should return a 502 if confirmations contain duplicate signers', async () => {
    const chain = chainBuilder().build();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const safe = safeBuilder().with('owners', [signer.address]).build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: chain.chainId,
        safe,
        signers: [signer],
      });
    const duplicateSignaturesMultisigTransaction =
      await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signer],
        });
    duplicateSignaturesMultisigTransaction.confirmations!.push({
      ...duplicateSignaturesMultisigTransaction.confirmations![0],
      owner: getAddress(faker.finance.ethereumAddress()),
    });
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(multisigTransaction) as MultisigTransaction,
      multisigToJson(
        duplicateSignaturesMultisigTransaction,
      ) as MultisigTransaction,
      multisigToJson(multisigTransaction) as MultisigTransaction,
    ];
    const contract = contractBuilder().build();

    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(pageBuilder().with('results', transactions).build()),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: rawify([]), status: 200 });
      }
      if (url.startsWith(getContractUrlPattern)) {
        return Promise.resolve({
          data: rawify(contract),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/queued`,
      )
      .expect(502)
      .expect({
        message: 'Duplicate signatures in confirmations',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });

  it('should return a 502 if confirmations contain an invalid EOA confirmation', async () => {
    const chain = chainBuilder().build();
    const signers = Array.from({ length: 2 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: chain.chainId,
        signers,
        safe,
      });
    const invalidEoaMultisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: chain.chainId,
        signers: [signers[0]],
        safe,
        signatureType: SignatureType.Eoa,
      });
    multisigTransaction.confirmations![0].owner = getAddress(
      faker.finance.ethereumAddress(),
    );
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(multisigTransaction) as MultisigTransaction,
      multisigToJson(invalidEoaMultisigTransaction) as MultisigTransaction,
      multisigToJson(multisigTransaction) as MultisigTransaction,
    ];
    const contract = contractBuilder().build();

    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(pageBuilder().with('results', transactions).build()),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: rawify([]), status: 200 });
      }
      if (url.startsWith(getContractUrlPattern)) {
        return Promise.resolve({
          data: rawify(contract),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/queued`,
      )
      .expect(502)
      .expect({
        message: 'Invalid signature',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });

  it('should return a 502 if confirmations contain an invalid invalid ETH_SIGN confirmation', async () => {
    const chain = chainBuilder().build();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const safe = safeBuilder().with('owners', [signer.address]).build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: chain.chainId,
        signers: [signer],
        safe,
        signatureType: SignatureType.Eoa,
      });
    const invalidEthSignMultisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: chain.chainId,
        signers: [signer],
        safe,
        signatureType: SignatureType.EthSign,
      });
    invalidEthSignMultisigTransaction.confirmations![0].owner = getAddress(
      faker.finance.ethereumAddress(),
    );
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(multisigTransaction) as MultisigTransaction,
      multisigToJson(invalidEthSignMultisigTransaction) as MultisigTransaction,
    ];
    const contract = contractBuilder().build();

    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('next', null) // avoid slicing the results
              .with('results', transactions)
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: rawify([]), status: 200 });
      }
      if (url.startsWith(getContractUrlPattern)) {
        return Promise.resolve({
          data: rawify(contract),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/queued`,
      )
      .expect(502)
      .expect({
        message: 'Invalid signature',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });

  it('should not block eth_sign', async () => {
    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      features: {
        ...baseConfiguration.features,
        ethSign: false,
      },
    });
    await initApp(testConfiguration);

    const chain = chainBuilder().build();
    const signers = Array.from(
      { length: faker.number.int({ min: 1, max: 5 }) },
      () => {
        const privateKey = generatePrivateKey();
        return privateKeyToAccount(privateKey);
      },
    );
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('nonce', safe.nonce)
      .with('isExecuted', false)
      .buildWithConfirmations({
        signers: signers,
        chainId: chain.chainId,
        safe,
        signatureType: SignatureType.EthSign,
      });
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(multisigTransaction) as MultisigTransaction,
    ];
    const contract = contractBuilder().build();
    const safeApps = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: rawify(contract), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify({
            count: 6,
            next: null,
            previous: null,
            results: transactions,
          }),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: rawify(safeApps), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/queued`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual({
          count: 2,
          next: null,
          previous: null,
          results: [
            {
              type: 'LABEL',
              label: 'Next',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safe.address}_${transactions[0].safeTxHash}`,
              }),
              conflictType: 'None',
            },
          ],
        });
      });
  });
});
