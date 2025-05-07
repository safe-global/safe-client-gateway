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
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import {
  toJson as multisigToJson,
  multisigTransactionBuilder,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { erc20TokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
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
  let loggingService: jest.MockedObjectDeep<ILoggingService>;

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
    loggingService = moduleFixture.get(LoggingService);

    // TODO: Override module to avoid spying
    jest.spyOn(loggingService, 'error');

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
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const page = pageBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
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
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/queued`,
      )
      .expect(502)
      .expect({ statusCode: 502, message: 'Bad gateway' });
  });

  it('should get a transactions queue with labels and conflict headers', async () => {
    const chainResponse = chainBuilder().build();
    const signers = Array.from({ length: 3 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safeResponse = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', 1)
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const contractResponse = contractBuilder().build();
    const getTransaction = async (
      nonce: number,
    ): Promise<MultisigTransaction> => {
      return multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('isExecuted', false)
        .with('nonce', nonce)
        .buildWithConfirmations({
          safe: safeResponse,
          chainId: chainResponse.chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
        });
    };
    const nonce1 = await getTransaction(1);
    const nonce2 = await getTransaction(2);
    const nonce3 = await getTransaction(3);
    const nonce4 = await getTransaction(4);
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce2) as MultisigTransaction,
      multisigToJson(nonce2) as MultisigTransaction,
      multisigToJson(nonce3) as MultisigTransaction,
      multisigToJson(nonce4) as MultisigTransaction,
    ];
    const tokenResponse = erc20TokenBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/`;
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
      if (url.startsWith(getTokenUrlPattern)) {
        return Promise.resolve({ data: rawify(tokenResponse), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued`,
      )
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
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainResponse = chainBuilder().build();
    const signers = Array.from({ length: 3 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const contractResponse = contractBuilder().build();
    const safeResponse = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', 1)
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const getTransaction = async (
      nonce: number,
    ): Promise<MultisigTransaction> => {
      return multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('isExecuted', false)
        .with('nonce', nonce)
        .buildWithConfirmations({
          safe: safeResponse,
          chainId: chainResponse.chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
        });
    };
    const nonce1 = await getTransaction(1);
    const nonce2 = await getTransaction(2);
    const nonce3 = await getTransaction(3);
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
    const tokenResponse = erc20TokenBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/`;
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
      if (url.startsWith(getTokenUrlPattern)) {
        return Promise.resolve({ data: rawify(tokenResponse), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued/?cursor=limit%3D10%26offset%3D2`,
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
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainResponse = chainBuilder().build();
    const signers = Array.from({ length: 3 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const contractResponse = contractBuilder().build();
    const safeResponse = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', 1)
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const safeAppsResponse = [safeAppBuilder().build()];
    const getTransaction = async (
      nonce: number,
    ): Promise<MultisigTransaction> => {
      return multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('isExecuted', false)
        .with('nonce', nonce)
        .buildWithConfirmations({
          safe: safeResponse,
          chainId: chainResponse.chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
        });
    };
    const nonce1 = await getTransaction(1);
    const nonce2 = await getTransaction(2);
    const transactions: Array<MultisigTransaction> = [
      multisigToJson(nonce1) as MultisigTransaction,
      multisigToJson(nonce2) as MultisigTransaction,
    ];
    const tokenResponse = erc20TokenBuilder().build();
    networkService.get.mockImplementation(({ url, networkRequest }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/`;
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
      if (url.startsWith(getTokenUrlPattern)) {
        return Promise.resolve({ data: rawify(tokenResponse), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued/?trusted=false`,
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

  describe('Verification', () => {
    it('should throw and log if the safeTxHash could not be calculated', async () => {
      const chainResponse = chainBuilder().build();
      const signers = Array.from({ length: 3 }, () => {
        const privateKey = generatePrivateKey();
        return privateKeyToAccount(privateKey);
      });
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeResponse = safeBuilder()
        .with('address', safeAddress)
        .with('nonce', 1)
        .with(
          'owners',
          signers.map((signer) => signer.address),
        )
        .build();
      const getTransaction = async (
        nonce: number,
      ): Promise<MultisigTransaction> => {
        return multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('nonce', nonce)
          .buildWithConfirmations({
            safe: safeResponse,
            chainId: chainResponse.chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
          });
      };
      const nonce1 = await getTransaction(1);
      const nonce2 = await getTransaction(2);
      safeResponse.version = null;
      const transactions: Array<MultisigTransaction> = [
        multisigToJson(nonce1) as MultisigTransaction,
        multisigToJson(nonce2) as MultisigTransaction,
      ];
      const tokenResponse = erc20TokenBuilder().build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/`;
      networkService.get.mockImplementation(({ url }) => {
        if (url === getChainUrl) {
          return Promise.resolve({
            data: rawify(chainResponse),
            status: 200,
          });
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
        if (url.startsWith(getTokenUrlPattern)) {
          return Promise.resolve({ data: rawify(tokenResponse), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued`,
        )
        .expect(502)
        .expect({
          message: 'Could not calculate safeTxHash',
          statusCode: 502,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        message: 'Could not calculate safeTxHash',
        chainId: chainResponse.chainId,
        safeAddress: safeResponse.address,
        safeVersion: safeResponse.version,
        safeTxHash: nonce1.safeTxHash,
        transaction: {
          to: nonce1.to,
          value: nonce1.value,
          data: nonce1.data,
          operation: nonce1.operation,
          safeTxGas: nonce1.safeTxGas,
          baseGas: nonce1.baseGas,
          gasPrice: nonce1.gasPrice,
          gasToken: nonce1.gasToken,
          refundReceiver: nonce1.refundReceiver,
          nonce: nonce1.nonce,
        },
        source: 'API',
      });
    });

    it('should throw and log if the safeTxHash does not match', async () => {
      const chainResponse = chainBuilder().build();
      const signers = Array.from({ length: 3 }, () => {
        const privateKey = generatePrivateKey();
        return privateKeyToAccount(privateKey);
      });
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeResponse = safeBuilder()
        .with('address', safeAddress)
        .with('nonce', 1)
        .with(
          'owners',
          signers.map((signer) => signer.address),
        )
        .build();
      const getTransaction = async (
        nonce: number,
      ): Promise<MultisigTransaction> => {
        return multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('nonce', nonce)
          .buildWithConfirmations({
            safe: safeResponse,
            chainId: chainResponse.chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
          });
      };
      const nonce1 = await getTransaction(1);
      const nonce2 = await getTransaction(2);
      nonce1.data = faker.string.hexadecimal({ length: 64 }) as `0x${string}`;
      const transactions: Array<MultisigTransaction> = [
        multisigToJson(nonce1) as MultisigTransaction,
        multisigToJson(nonce2) as MultisigTransaction,
      ];
      const tokenResponse = erc20TokenBuilder().build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/`;
      networkService.get.mockImplementation(({ url }) => {
        if (url === getChainUrl) {
          return Promise.resolve({
            data: rawify(chainResponse),
            status: 200,
          });
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
          return Promise.resolve({
            data: rawify(safeResponse),
            status: 200,
          });
        }
        if (url.startsWith(getTokenUrlPattern)) {
          return Promise.resolve({ data: rawify(tokenResponse), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued`,
        )
        .expect(502)
        .expect({
          message: 'Invalid safeTxHash',
          statusCode: 502,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        event: 'safeTxHash does not match',
        chainId: chainResponse.chainId,
        safeAddress: safeResponse.address,
        safeVersion: safeResponse.version,
        safeTxHash: nonce1.safeTxHash,
        transaction: {
          to: nonce1.to,
          value: nonce1.value,
          data: nonce1.data,
          operation: nonce1.operation,
          safeTxGas: nonce1.safeTxGas,
          baseGas: nonce1.baseGas,
          gasPrice: nonce1.gasPrice,
          gasToken: nonce1.gasToken,
          refundReceiver: nonce1.refundReceiver,
          nonce: nonce1.nonce,
        },
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
      });
    });

    it('should throw if a signature is not a valid hex bytes string', async () => {
      const chainResponse = chainBuilder().build();
      const signers = Array.from({ length: 3 }, () => {
        const privateKey = generatePrivateKey();
        return privateKeyToAccount(privateKey);
      });
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeResponse = safeBuilder()
        .with('address', safeAddress)
        .with('nonce', 1)
        .with(
          'owners',
          signers.map((signer) => signer.address),
        )
        .build();
      const getTransaction = async (
        nonce: number,
      ): Promise<MultisigTransaction> => {
        return multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('nonce', nonce)
          .buildWithConfirmations({
            safe: safeResponse,
            chainId: chainResponse.chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
          });
      };
      const nonce1 = await getTransaction(1);
      nonce1.confirmations![0].signature = '0xdeadbee';
      const nonce2 = await getTransaction(2);
      const transactions: Array<MultisigTransaction> = [
        multisigToJson(nonce1) as MultisigTransaction,
        multisigToJson(nonce2) as MultisigTransaction,
      ];

      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      networkService.get.mockImplementation(({ url }) => {
        if (url === getChainUrl) {
          return Promise.resolve({
            data: rawify(chainResponse),
            status: 200,
          });
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
          return Promise.resolve({
            data: rawify(safeResponse),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued`,
        )
        .expect(502)
        .expect({
          message: 'Bad gateway',
          statusCode: 502,
        });

      expect(loggingService.error).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TRANSACTION_VALIDITY',
        }),
      );
    });

    it('should throw if a signature length is invalid', async () => {
      const chainResponse = chainBuilder().build();
      const signers = Array.from({ length: 3 }, () => {
        const privateKey = generatePrivateKey();
        return privateKeyToAccount(privateKey);
      });
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeResponse = safeBuilder()
        .with('address', safeAddress)
        .with('nonce', 1)
        .with(
          'owners',
          signers.map((signer) => signer.address),
        )
        .build();
      const getTransaction = async (
        nonce: number,
      ): Promise<MultisigTransaction> => {
        return multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('nonce', nonce)
          .buildWithConfirmations({
            safe: safeResponse,
            chainId: chainResponse.chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
          });
      };
      const nonce1 = await getTransaction(1);
      nonce1.confirmations![0].signature = '0xdeadbee';
      const nonce2 = await getTransaction(2);
      const transactions: Array<MultisigTransaction> = [
        multisigToJson(nonce1) as MultisigTransaction,
        multisigToJson(nonce2) as MultisigTransaction,
      ];

      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      networkService.get.mockImplementation(({ url }) => {
        if (url === getChainUrl) {
          return Promise.resolve({
            data: rawify(chainResponse),
            status: 200,
          });
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
          return Promise.resolve({
            data: rawify(safeResponse),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued`,
        )
        .expect(502)
        .expect({
          message: 'Bad gateway',
          statusCode: 502,
        });

      expect(loggingService.error).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TRANSACTION_VALIDITY',
        }),
      );
    });

    it.each(Object.values(SignatureType))(
      'should throw if a confirmation contains an invalid %s signature',
      async (signatureType) => {
        const chainResponse = chainBuilder().build();
        const signers = Array.from({ length: 3 }, () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        });
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const safeResponse = safeBuilder()
          .with('address', safeAddress)
          .with('nonce', 1)
          .with(
            'owners',
            signers.map((signer) => signer.address),
          )
          .build();
        const getTransaction = async (
          nonce: number,
        ): Promise<MultisigTransaction> => {
          return multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('isExecuted', false)
            .with('nonce', nonce)
            .buildWithConfirmations({
              safe: safeResponse,
              chainId: chainResponse.chainId,
              signers: faker.helpers.arrayElements(signers, {
                min: 1,
                max: signers.length,
              }),
              signatureType,
            });
        };
        const nonce1 = await getTransaction(1);
        const v = nonce1.confirmations![0].signature?.slice(-2);
        nonce1.confirmations![0].signature = `0x${'-'.repeat(128)}${v}`;
        const nonce2 = await getTransaction(2);
        const transactions: Array<MultisigTransaction> = [
          multisigToJson(nonce1) as MultisigTransaction,
          multisigToJson(nonce2) as MultisigTransaction,
        ];

        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
        const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
        const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
        networkService.get.mockImplementation(({ url }) => {
          if (url === getChainUrl) {
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
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
            return Promise.resolve({
              data: rawify(safeResponse),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued`,
          )
          .expect(502)
          .expect({
            message: 'Bad gateway',
            statusCode: 502,
          });

        expect(loggingService.error).not.toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'TRANSACTION_VALIDITY',
          }),
        );
      },
    );

    it('should throw and log if a signer is blocked', async () => {
      const chainResponse = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          blockchain: {
            ...defaultConfiguration.blockchain,
            blocklist: [signer.address],
          },
        };
      };
      await initApp(testConfiguration);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeResponse = safeBuilder()
        .with('address', safeAddress)
        .with('nonce', 1)
        .with('owners', [signer.address])
        .build();
      const getTransaction = async (
        nonce: number,
      ): Promise<MultisigTransaction> => {
        return multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('nonce', nonce)
          .buildWithConfirmations({
            safe: safeResponse,
            chainId: chainResponse.chainId,
            signers: [signer],
          });
      };
      const nonce1 = await getTransaction(1);
      const nonce2 = await getTransaction(2);
      const transactions: Array<MultisigTransaction> = [
        multisigToJson(nonce1) as MultisigTransaction,
        multisigToJson(nonce2) as MultisigTransaction,
      ];
      const tokenResponse = erc20TokenBuilder().build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/`;
      networkService.get.mockImplementation(({ url }) => {
        if (url === getChainUrl) {
          return Promise.resolve({
            data: rawify(chainResponse),
            status: 200,
          });
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
          return Promise.resolve({
            data: rawify(safeResponse),
            status: 200,
          });
        }
        if (url.startsWith(getTokenUrlPattern)) {
          return Promise.resolve({ data: rawify(tokenResponse), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued`,
        )
        .expect(502)
        .expect({
          message: 'Unauthorized address',
          statusCode: 502,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        event: 'Unauthorized address',
        chainId: chainResponse.chainId,
        safeAddress: safeResponse.address,
        safeVersion: safeResponse.version,
        safeTxHash: nonce1.safeTxHash,
        blockedAddress: signer.address,
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
      });
    });

    it('should throw and log if a signer does not match the confirmation owner', async () => {
      const chainResponse = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeResponse = safeBuilder()
        .with('address', safeAddress)
        .with('nonce', 1)
        .with('owners', [signer.address])
        .build();
      const getTransaction = async (
        nonce: number,
      ): Promise<MultisigTransaction> => {
        return multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('nonce', nonce)
          .buildWithConfirmations({
            safe: safeResponse,
            chainId: chainResponse.chainId,
            signers: [signer],
          });
      };
      const nonce1 = await getTransaction(1);
      nonce1.confirmations![0].owner = getAddress(
        faker.finance.ethereumAddress(),
      );
      const nonce2 = await getTransaction(2);
      const transactions: Array<MultisigTransaction> = [
        multisigToJson(nonce1) as MultisigTransaction,
        multisigToJson(nonce2) as MultisigTransaction,
      ];
      const tokenResponse = erc20TokenBuilder().build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/`;
      networkService.get.mockImplementation(({ url }) => {
        if (url === getChainUrl) {
          return Promise.resolve({
            data: rawify(chainResponse),
            status: 200,
          });
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
          return Promise.resolve({
            data: rawify(safeResponse),
            status: 200,
          });
        }
        if (url.startsWith(getTokenUrlPattern)) {
          return Promise.resolve({ data: rawify(tokenResponse), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued`,
        )
        .expect(502)
        .expect({
          message: 'Invalid signature',
          statusCode: 502,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        event: 'Recovered address does not match signer',
        chainId: chainResponse.chainId,
        safeAddress: safeResponse.address,
        safeVersion: safeResponse.version,
        safeTxHash: nonce1.safeTxHash,
        signerAddress: nonce1.confirmations![0].owner,
        signature: nonce1.confirmations![0].signature,
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
      });
    });

    it('should throw and log if a signer is not an owner of the Safe', async () => {
      const chainResponse = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeResponse = safeBuilder()
        .with('address', safeAddress)
        .with('nonce', 1)
        .with('owners', [signer.address])
        .build();
      const getTransaction = async (
        nonce: number,
      ): Promise<MultisigTransaction> => {
        return multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('nonce', nonce)
          .buildWithConfirmations({
            safe: safeResponse,
            chainId: chainResponse.chainId,
            signers: [signer],
          });
      };
      const nonce1 = await getTransaction(1);
      const nonce2 = await getTransaction(2);
      const transactions: Array<MultisigTransaction> = [
        multisigToJson(nonce1) as MultisigTransaction,
        multisigToJson(nonce2) as MultisigTransaction,
      ];
      safeResponse.owners = [getAddress(faker.finance.ethereumAddress())];
      const tokenResponse = erc20TokenBuilder().build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/`;
      networkService.get.mockImplementation(({ url }) => {
        if (url === getChainUrl) {
          return Promise.resolve({
            data: rawify(chainResponse),
            status: 200,
          });
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
          return Promise.resolve({
            data: rawify(safeResponse),
            status: 200,
          });
        }
        if (url.startsWith(getTokenUrlPattern)) {
          return Promise.resolve({ data: rawify(tokenResponse), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chainResponse.chainId}/safes/${safeAddress}/transactions/queued`,
        )
        .expect(502)
        .expect({
          message: 'Invalid signature',
          statusCode: 502,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        event: 'Recovered address does not match signer',
        chainId: chainResponse.chainId,
        safeAddress: safeResponse.address,
        safeVersion: safeResponse.version,
        safeTxHash: nonce1.safeTxHash,
        signerAddress: nonce1.confirmations![0].owner,
        signature: nonce1.confirmations![0].signature,
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
      });
    });
  });
});
