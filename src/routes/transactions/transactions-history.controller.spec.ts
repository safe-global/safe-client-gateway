import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  creationTransactionBuilder,
  toJson as creationTransactionToJson,
} from '@/domain/safe/entities/__tests__/creation-transaction.builder';
import {
  ethereumTransactionBuilder,
  toJson as ethereumTransactionToJson,
} from '@/domain/safe/entities/__tests__/ethereum-transaction.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/domain/safe/entities/__tests__/module-transaction.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import {
  nativeTokenTransferBuilder,
  toJson as nativeTokenTransferToJson,
} from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TokenType } from '@/domain/tokens/entities/token.entity';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import {
  erc20TransferBuilder,
  toJson as erc20TransferToJson,
} from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import {
  erc721TransferBuilder,
  toJson as erc721TransferToJson,
} from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import { TransactionItem } from '@/routes/transactions/entities/transaction-item.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { getAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';

describe('Transactions History Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  const prefixLength = 3;
  const suffixLength = 4;

  beforeEach(async () => {
    jest.resetAllMocks();

    const testConfiguration: typeof configuration = () => ({
      ...configuration(),
      mappings: {
        ...configuration().mappings,
        history: {
          maxNestedTransfers: 5,
        },
        imitation: {
          prefixLength,
          suffixLength,
        },
      },
      features: {
        ...configuration().features,
        imitationMapping: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Failure: Config API fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      if (url === getChainUrl) {
        const error = new NetworkResponseError(new URL(getChainUrl), {
          status: 500,
        } as Response);
        return Promise.reject(error);
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/history`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });
  });

  it('Failure: Transaction API fails', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        const error = new NetworkResponseError(new URL(getAllTransactions), {
          status: 500,
        } as Response);
        return Promise.reject(error);
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });
  });

  it('Failure: data page validation fails', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chain = chainBuilder().build();
    const page = pageBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: { ...page, results: faker.word.words() },
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safeAddress}/transactions/history/`,
      )
      .expect(500)
      .expect({ statusCode: 500, message: 'Internal server error' });
  });

  it('Should return only creation transaction', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const timezoneOffset = 3600 * 2; //Offset of 2 hours
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const safe = safeBuilder().build();
    const transactionHistoryBuilder = {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
    const creationTransaction = creationTransactionBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getSafeCreationUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/creation/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      if (url === getSafeCreationUrl) {
        return Promise.resolve({
          data: creationTransactionToJson(creationTransaction),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/?timezone_offset=${timezoneOffset}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(2);
        expect(body.results[1].transaction.id).toContain('creation_');
      });
  });

  it('Should return correctly each date label', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const moduleTransaction = moduleTransactionToJson(
      moduleTransactionBuilder()
        .with('dataDecoded', null)
        .with('executionDate', new Date('2022-12-06T23:00:00Z'))
        .build(),
    );
    const multisigTransaction = multisigTransactionToJson(
      multisigTransactionBuilder()
        .with('dataDecoded', null)
        .with('origin', null)
        .with('executionDate', new Date('2022-12-25T00:00:00Z'))
        .build(),
    );
    const nativeTokenTransfer = nativeTokenTransferBuilder()
      .with('executionDate', new Date('2022-12-31T00:00:00Z'))
      .build();
    const incomingTransaction = ethereumTransactionToJson(
      ethereumTransactionBuilder()
        .with('executionDate', nativeTokenTransfer.executionDate)
        .with('transfers', [
          nativeTokenTransferToJson(nativeTokenTransfer) as Transfer,
        ])
        .build(),
    );
    const transactionHistoryBuilder = {
      count: 40,
      next: `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/?executed=false&limit=10&offset=10&queued=true&trusted=true`,
      previous: null,
      results: [moduleTransaction, multisigTransaction, incomingTransaction],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history/`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(
          6, //3 date labels and 3 transactions
        );
        expect(body.results[0].timestamp).toEqual(
          1670367600000, // Date('2022-12-06T23:00:00Z').getTime()
        );
        expect(body.results[2].timestamp).toEqual(
          1671926400000, // Date('2022-12-25T00:00:00Z').getTime()
        );
        expect(body.results[4].timestamp).toEqual(
          1672444800000, // Date('2022-12-31T00:00:00Z').getTime(),
        );
      });
  });

  it('Should not change date label with time offset', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const timezoneOffset = 2 * 60 * 60 * 1000 + 1; // 2 hours in milliseconds + 1 millisecond to test precision of offsetting
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const moduleTransaction = moduleTransactionToJson(
      moduleTransactionBuilder()
        .with('dataDecoded', null)
        .with('executionDate', new Date('2022-12-31T22:09:36Z'))
        .build(),
    );
    const safe = safeBuilder().build();
    const transactionHistoryBuilder = {
      count: 40,
      next: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/?executed=false&limit=10&offset=10&queued=true&trusted=true`,
      previous: null,
      results: [moduleTransaction],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/?timezone_offset=${timezoneOffset}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(2);
        expect(body.results[0].timestamp).toEqual(
          new Date('2022-12-31T22:09:36Z').getTime(),
        );
      });
  });

  it('Should group transactions according to timezone offset', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const timezoneOffset = 60 * 60 * 1000; // 1 hour in milliseconds
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const moduleTransaction1 = moduleTransactionBuilder()
      .with('dataDecoded', null)
      .with('executionDate', new Date('2022-12-31T21:09:36Z'))
      .build();
    const moduleTransaction2 = moduleTransactionBuilder()
      .with('dataDecoded', null)
      .with('executionDate', new Date('2022-12-31T23:09:36Z'))
      .build();
    const safe = safeBuilder().build();
    const transactionHistoryBuilder = {
      count: 40,
      next: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/?executed=false&limit=10&offset=10&queued=true&trusted=true`,
      previous: null,
      results: [
        moduleTransactionToJson(moduleTransaction2),
        moduleTransactionToJson(moduleTransaction1),
      ],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/?timezone_offset=${timezoneOffset}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(4);
        // Top group represents the header with the time shifted (January 1, 2023)
        // Note that the value of the header should still be in UTC
        expect(body.results[0].timestamp).toEqual(
          new Date('2022-12-31T23:09:36Z').getTime(),
        );
        // The timezone offset should not change the time of the transaction (i.e. UTC should still be used)
        expect(body.results[1].transaction.timestamp).toEqual(
          moduleTransaction2.executionDate.getTime(),
        );
        // Followup group represents the header with the time shifted (December 31, 2022)
        expect(body.results[2].timestamp).toEqual(
          new Date('2022-12-31T21:09:36Z').getTime(),
        );
        // The timezone offset should not change the time of the transaction (i.e. UTC should still be used)
        expect(body.results[3].transaction.timestamp).toEqual(
          moduleTransaction1.executionDate.getTime(),
        );
      });
  });

  it('Should return correctly each transaction', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const moduleTransaction = moduleTransactionBuilder()
      .with('executionDate', new Date('2022-12-14T13:19:12Z'))
      .with('safe', getAddress(safe.address))
      .with('isSuccessful', true)
      .with('data', null)
      .with('operation', 0)
      .with('value', faker.number.int({ min: 1 }).toString())
      .with('moduleTransactionId', 'i5a6754140f0432d3b')
      .build();
    const multisigTransactionToAddress = faker.finance.ethereumAddress();
    const multisigTransactionValue = faker.string.numeric();
    const multisigTransaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('value', '0')
      .with('operation', 0)
      .with('safeTxGas', 0)
      .with('executionDate', new Date('2022-11-16T07:31:11Z'))
      .with('submissionDate', new Date('2022-11-16T07:29:56.401601Z'))
      .with('safeTxHash', '0x31d44c67')
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('origin', null)
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'transfer')
          .with('parameters', [
            dataDecodedParameterBuilder()
              .with('name', 'to')
              .with('type', 'address')
              .with('value', multisigTransactionToAddress)
              .build(),
            dataDecodedParameterBuilder()
              .with('name', 'value')
              .with('type', 'uint256')
              .with('value', multisigTransactionValue)
              .build(),
          ])
          .build(),
      )
      .with('confirmationsRequired', 2)
      .with('confirmations', [
        confirmationBuilder().build(),
        confirmationBuilder().build(),
      ])
      .build();

    const nativeTokenTransfer = nativeTokenTransferBuilder()
      .with('executionDate', new Date('2022-08-04T12:44:22Z'))
      .with('to', safe.address)
      .with('transferId', 'e1015fc6905859c69')
      .build();
    const incomingTransaction = ethereumTransactionBuilder()
      .with('transfers', [
        nativeTokenTransferToJson(nativeTokenTransfer) as Transfer,
      ])
      .build();
    const tokenResponse = tokenBuilder()
      .with('type', TokenType.Erc20)
      .with('address', getAddress(multisigTransaction.to))
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/${multisigTransaction.to}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: pageBuilder()
            .with('results', [
              moduleTransactionToJson(moduleTransaction),
              multisigTransactionToJson(multisigTransaction),
              ethereumTransactionToJson(incomingTransaction),
            ])
            .build(),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: tokenResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history/`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'DATE_LABEL',
              timestamp: expect.any(Number),
            },
            {
              type: 'TRANSACTION',
              transaction: {
                id: `module_${safe.address}_i5a6754140f0432d3b`,
                safeAppInfo: null,
                timestamp: moduleTransaction.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: moduleTransaction.safe },
                  recipient: { value: moduleTransaction.to },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'NATIVE_COIN',
                    value: moduleTransaction.value,
                  },
                },
                executionInfo: {
                  type: 'MODULE',
                  address: { value: moduleTransaction.module },
                },
              },
              conflictType: 'None',
            },
            {
              type: 'DATE_LABEL',
              timestamp: expect.any(Number),
            },
            {
              type: 'TRANSACTION',
              transaction: {
                id: `multisig_${safe.address}_0x31d44c67`,
                timestamp: 1668583871000,
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: multisigTransaction.safe },
                  recipient: { value: multisigTransactionToAddress },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC20',
                    tokenAddress: getAddress(multisigTransaction.to),
                    tokenName: tokenResponse.name,
                    tokenSymbol: tokenResponse.symbol,
                    logoUri: tokenResponse.logoUri,
                    decimals: tokenResponse.decimals,
                    value: multisigTransactionValue,
                  },
                },
                executionInfo: {
                  type: 'MULTISIG',
                  nonce: multisigTransaction.nonce,
                  confirmationsRequired: 2,
                  confirmationsSubmitted: 2,
                  missingSigners: null,
                },
                safeAppInfo: null,
              },
              conflictType: 'None',
            },
            {
              type: 'DATE_LABEL',
              timestamp: expect.any(Number),
            },
            {
              type: 'TRANSACTION',
              transaction: {
                id: `transfer_${safe.address}_e1015fc6905859c69`,
                executionInfo: null,
                safeAppInfo: null,
                timestamp: nativeTokenTransfer.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: nativeTokenTransfer.from },
                  recipient: { value: nativeTokenTransfer.to },
                  direction: 'INCOMING',
                  transferInfo: {
                    type: 'NATIVE_COIN',
                    value: nativeTokenTransfer.value,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('Should include safe creation transaction', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const moduleTransaction = moduleTransactionBuilder()
      .with('dataDecoded', null)
      .build();
    const safe = safeBuilder().build();
    const allTransactionsResponse = {
      count: 2,
      next: null,
      previous: null,
      results: [moduleTransactionToJson(moduleTransaction)],
    };
    const creationTransaction = creationTransactionBuilder()
      .with('created', new Date(moduleTransaction.executionDate))
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrl = `${chainResponse.transactionService}/api/v1/contracts/`;
      const getSafeCreationUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/creation/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: allTransactionsResponse,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({
          data: safe,
          status: 200,
        });
      }
      if (url === getSafeCreationUrl) {
        return Promise.resolve({
          data: creationTransactionToJson(creationTransaction),
          status: 200,
        });
      }
      if (url.includes(getContractUrl)) {
        const error = new NetworkResponseError(
          new URL(getContractUrl),
          {
            status: 404,
          } as Response,
          { detail: 'Not found' },
        );
        return Promise.reject(error);
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/`)
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(3);
        expect(body.results[2].transaction.timestamp).toEqual(
          creationTransaction.created.getTime(),
        );
        expect(body.results[2].transaction.txInfo.creator.value).toEqual(
          creationTransaction.creator,
        );
        expect(body.results[2].transaction.txInfo.factory.value).toEqual(
          creationTransaction.factoryAddress,
        );
        expect(body.results[2].transaction.txInfo.implementation.value).toEqual(
          creationTransaction.masterCopy,
        );
        expect(body.results[2].transaction.txInfo.transactionHash).toEqual(
          creationTransaction.transactionHash,
        );
      });
  });

  it('Should keep the client pagination', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const limit = 5;
    const offset = 5;
    const moduleTransaction = moduleTransactionToJson(
      moduleTransactionBuilder().with('dataDecoded', null).build(),
    );
    const safe = safeBuilder().build();
    const clientNextCursor = `cursor=limit%3D${limit}%26offset%3D10`;
    const clientPreviousCursor = `cursor=limit%3D${limit}%26offset%3D0`;
    const transactionHistoryBuilder = {
      count: 40,
      next: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/?executed=false&limit=6&offset=10&queued=true&trusted=true`,
      previous: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/?executed=false&limit=6&queued=true&trusted=true`,
      results: [moduleTransaction],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/?cursor=limit%3D${limit}%26offset%3D${offset}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.next).toContain(clientNextCursor);
        expect(body.previous).toContain(clientPreviousCursor);
      });

    expect(networkService.get).toHaveBeenCalledWith({
      url: `${safeConfigUrl}/api/v1/chains/${chainId}`,
    });
    expect(networkService.get).toHaveBeenCalledWith({
      url: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`,
      networkRequest: {
        params: {
          executed: true,
          offset: offset - 1,
          limit: limit + 1,
          ordering: undefined,
          queued: false,
          safe: safeAddress,
        },
      },
    });
  });

  it('Should limit the amount of nested transfers', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const maxNestedTransfers = app
      .get(IConfigurationService)
      .getOrThrow('mappings.history.maxNestedTransfers');
    const date = new Date();
    const transfers = faker.helpers.multiple(
      () =>
        nativeTokenTransferToJson(
          nativeTokenTransferBuilder().with('executionDate', date).build(),
        ) as Transfer,
      // the amount of transfers is the double of the max value
      { count: maxNestedTransfers * 2 },
    );
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder().with('transfers', transfers).build(),
        ),
      ],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history/`,
      )
      .expect(200)
      .then(({ body }) => {
        // the amount of TransactionItems is limited to the max value
        expect(
          body.results.filter(
            (item: TransactionItem) => item.type === 'TRANSACTION',
          ),
        ).toHaveLength(maxNestedTransfers);
      });
  });

  it('Untrusted token transfers are ignored by default', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const untrustedToken = tokenBuilder().with('trusted', false).build();
    const trustedToken = tokenBuilder().with('trusted', true).build();
    // Use same date so that groups are created deterministically
    const date = faker.date.recent();
    const transfers = [
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', untrustedToken.address)
          .with('executionDate', date)
          .with('value', faker.string.numeric({ exclude: ['0'] }))
          .build(),
      ) as Transfer,
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', trustedToken.address)
          .with('executionDate', date)
          .with('value', faker.string.numeric({ exclude: ['0'] }))
          .build(),
      ) as Transfer,
    ];
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder().with('transfers', transfers).build(),
        ),
      ],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${trustedToken.address}`:
          return Promise.resolve({ data: trustedToken, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${untrustedToken.address}`:
          return Promise.resolve({ data: untrustedToken, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history`,
      )
      .expect(200)
      .expect((response) => {
        // One date label and one transaction
        expect(response.body['results']).toHaveLength(2);
        expect(response.body['results'][1]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: trustedToken.address,
              },
            },
          },
        });
      });
  });

  it('Should return an empty array with no date labels if all the token transfers are untrusted', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const untrustedToken = tokenBuilder().with('trusted', false).build();
    // Use same date so that groups are created deterministically
    const date = faker.date.recent();
    const oneDayAfter = new Date(date.getTime() + 1000 * 60 * 60 * 24);
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('transfers', [
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .with('value', faker.string.numeric({ exclude: ['0'] }))
                  .build(),
              ) as Transfer,
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .with('value', faker.string.numeric({ exclude: ['0'] }))
                  .build(),
              ) as Transfer,
            ])
            .with('executionDate', date)
            .build(),
        ),
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('transfers', [
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .with('value', faker.string.numeric({ exclude: ['0'] }))
                  .build(),
              ) as Transfer,
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .with('value', faker.string.numeric({ exclude: ['0'] }))
                  .build(),
              ) as Transfer,
            ])
            .with('executionDate', oneDayAfter)
            .build(),
        ),
      ],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${untrustedToken.address}`:
          return Promise.resolve({ data: untrustedToken, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history`,
      )
      .expect(200)
      .expect((response) => {
        // Empty array
        expect(response.body['results']).toEqual([]);
      });
  });

  it('Should not return a date label if all the token transfers for that date are untrusted', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const untrustedToken = tokenBuilder().with('trusted', false).build();
    const trustedToken = tokenBuilder().with('trusted', true).build();
    // Use same date so that groups are created deterministically
    const date = faker.date.recent();
    const oneDayAfter = new Date(date.getTime() + 1000 * 60 * 60 * 24);
    const twoDaysAfter = new Date(date.getTime() + 1000 * 60 * 60 * 48);
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('transfers', [
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .with('value', faker.string.numeric({ exclude: ['0'] }))
                  .with('executionDate', date)
                  .build(),
              ) as Transfer,
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', trustedToken.address)
                  .with('value', faker.string.numeric({ exclude: ['0'] }))
                  .with('executionDate', date)
                  .build(),
              ) as Transfer,
            ])
            .with('executionDate', date)
            .build(),
        ),
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('transfers', [
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .with('value', faker.string.numeric({ exclude: ['0'] }))
                  .with('executionDate', oneDayAfter)
                  .build(),
              ) as Transfer,
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .with('value', faker.string.numeric({ exclude: ['0'] }))
                  .with('executionDate', oneDayAfter)
                  .build(),
              ) as Transfer,
            ])
            .with('executionDate', oneDayAfter)
            .build(),
        ),
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('transfers', [
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', trustedToken.address)
                  .with('value', faker.string.numeric({ exclude: ['0'] }))
                  .with('executionDate', twoDaysAfter)
                  .build(),
              ) as Transfer,
            ])
            .with('executionDate', twoDaysAfter)
            .build(),
        ),
      ],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${trustedToken.address}`:
          return Promise.resolve({ data: trustedToken, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${untrustedToken.address}`:
          return Promise.resolve({ data: untrustedToken, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history`,
      )
      .expect(200)
      .expect((response) => {
        // Two date labels and two transactions
        expect(response.body['results']).toHaveLength(4);
        expect(response.body['results'][0]).toMatchObject({
          type: 'DATE_LABEL',
        });
        expect(response.body['results'][1]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: trustedToken.address,
              },
            },
          },
        });
        expect(response.body['results'][2]).toMatchObject({
          type: 'DATE_LABEL',
        });
        expect(response.body['results'][3]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: trustedToken.address,
              },
            },
          },
        });
      });
  });

  it('Untrusted transfers are returned when trusted=false', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const untrustedToken = tokenBuilder().with('trusted', false).build();
    const trustedToken = tokenBuilder().with('trusted', true).build();
    // Use same date so that groups are created deterministically
    const date = faker.date.recent();
    const transfers = [
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', untrustedToken.address)
          .with('executionDate', date)
          .with('value', faker.string.numeric({ exclude: ['0'] }))
          .build(),
      ) as Transfer,
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', trustedToken.address)
          .with('executionDate', date)
          .with('value', faker.string.numeric({ exclude: ['0'] }))
          .build(),
      ) as Transfer,
    ];
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder().with('transfers', transfers).build(),
        ),
      ],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${trustedToken.address}`:
          return Promise.resolve({ data: trustedToken, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${untrustedToken.address}`:
          return Promise.resolve({ data: untrustedToken, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false`,
      )
      .expect(200)
      .expect((response) => {
        // One date label and one transaction
        expect(response.body['results']).toHaveLength(3);
        expect(response.body['results'][1]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: untrustedToken.address,
              },
            },
          },
        });
        expect(response.body['results'][2]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: trustedToken.address,
              },
            },
          },
        });
      });
  });

  it('Nested transfers with a value of zero are not returned', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const trustedToken = tokenBuilder().with('trusted', true).build();
    // Use same date so that groups are created deterministically
    const date = faker.date.recent();
    const transfers = [
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', trustedToken.address)
          .with('executionDate', date)
          .with('value', '1')
          .build(),
      ) as Transfer,
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', trustedToken.address)
          .with('executionDate', date)
          .with('value', '0')
          .build(),
      ) as Transfer,
    ];
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder().with('transfers', transfers).build(),
        ),
      ],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${trustedToken.address}`:
          return Promise.resolve({ data: trustedToken, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history`,
      )
      .expect(200)
      .expect((response) => {
        // One date label and one transaction
        expect(response.body['results']).toHaveLength(2);
        expect(response.body['results'][1]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                value: '1',
                tokenAddress: trustedToken.address,
              },
            },
          },
        });
      });
  });

  it('ERC721 transfers marked as non-trusted are returned', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const notTrustedErc721 = tokenBuilder()
      .with('trusted', false)
      .with('type', TokenType.Erc721)
      .build();
    const trustedErc721 = tokenBuilder()
      .with('trusted', true)
      .with('type', TokenType.Erc721)
      .build();
    // Use the same date so that groups are created deterministically
    const date = faker.date.recent();
    const transfers = [
      erc721TransferToJson(
        erc721TransferBuilder()
          .with('tokenAddress', notTrustedErc721.address)
          .with('executionDate', date)
          .build(),
      ) as Transfer,
      erc721TransferToJson(
        erc721TransferBuilder()
          .with('tokenAddress', trustedErc721.address)
          .with('executionDate', date)
          .build(),
      ) as Transfer,
    ];
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder().with('transfers', transfers).build(),
        ),
      ],
    };
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${trustedErc721.address}`:
          return Promise.resolve({ data: trustedErc721, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${notTrustedErc721.address}`:
          return Promise.resolve({ data: notTrustedErc721, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history`,
      )
      .expect(200)
      .expect((response) => {
        // One date label and one transaction
        expect(response.body['results']).toHaveLength(3);
        expect(response.body['results'][1]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: notTrustedErc721.address,
              },
            },
          },
        });
        expect(response.body['results'][2]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: trustedErc721.address,
              },
            },
          },
        });
      });
  });

  describe('Address poisoning', () => {
    // TODO: Add tests with a mixture of (non-)trusted tokens, as well add builder-based tests
    describe('Trusted tokens', () => {
      it('should flag outgoing ERC-20 transfers that imitate a direct predecessor', async () => {
        // Example taken from arb1:0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4 - marked as trusted
        const chain = chainBuilder().build();
        const safe = safeBuilder()
          .with('address', '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4')
          .with('owners', [
            '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
            '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
          ])
          .build();

        const results = [
          {
            executionDate: '2024-03-20T09:42:58Z',
            to: '0x0e74DE9501F54610169EDB5D6CC6b559d403D4B7',
            data: '0x12514bba00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000cdb94376e0330b13f5becaece169602cbb14399c000000000000000000000000a52cd97c022e5373ee305010ff2263d29bb87a7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009a6de84bf23ed9ba92bdb8027037975ef181b1c4000000000000000000000000345e400b58fbc0f9bc0eb176b6a125f35056ac300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fd737d98d9f6b566cc104fd40aecc449b8eaa5120000000000000000000000001b4b73713ada8a6f864b58d0dd6099ca54e59aa30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000878678326eac90000000000000000000000000000000000000000000000000000000000000001ed02f00000000000000000000000000000000000000000000000000000000000000000',
            txHash:
              '0xf6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb4',
            blockNumber: 192295013,
            transfers: [
              {
                type: 'ERC20_TRANSFER',
                executionDate: '2024-03-20T09:42:58Z',
                blockNumber: 192295013,
                transactionHash:
                  '0xf6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb4',
                to: '0xFd737d98d9F6b566cc104Fd40aEcC449b8EaA512',
                value: '40000000000000000000000',
                tokenId: null,
                tokenAddress: '0xcDB94376E0330B13F5Becaece169602cbB14399c',
                transferId:
                  'ef6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb44',
                tokenInfo: {
                  type: 'ERC20',
                  address: '0xcDB94376E0330B13F5Becaece169602cbB14399c',
                  name: 'Arbitrum',
                  symbol: 'ARB',
                  decimals: 18,
                  logoUri:
                    'https://safe-transaction-assets.safe.global/tokens/logos/0xcDB94376E0330B13F5Becaece169602cbB14399c.png',
                  trusted: true,
                },
                from: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
              },
            ],
            txType: 'ETHEREUM_TRANSACTION',
            from: '0xA504C7e72AD25927EbFA6ea14aD5EA56fb0aB64a',
          },
          {
            safe: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
            to: '0x912CE59144191C1204E64559FE8253a0e49E6548',
            value: '0',
            data: '0xa9059cbb000000000000000000000000fd7e78798f312a29bb03133de9d26e151d3aa512000000000000000000000000000000000000000000000878678326eac9000000',
            operation: 0,
            gasToken: '0x0000000000000000000000000000000000000000',
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: '0',
            refundReceiver: '0x0000000000000000000000000000000000000000',
            nonce: 3,
            executionDate: '2024-03-20T09:41:25Z',
            submissionDate: '2024-03-20T09:38:11.447366Z',
            modified: '2024-03-20T09:41:25Z',
            blockNumber: 192294646,
            transactionHash:
              '0x7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f371817813',
            safeTxHash:
              '0xa0772fe5d26572fa777e0b4557da9a03d208086078215245ed26502f7a7bf683',
            proposer: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
            executor: '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
            isExecuted: true,
            isSuccessful: true,
            ethGasPrice: '10946000',
            maxFeePerGas: null,
            maxPriorityFeePerGas: null,
            gasUsed: 249105,
            fee: '2726703330000',
            origin: '{}',
            dataDecoded: {
              method: 'transfer',
              parameters: [
                {
                  name: 'to',
                  type: 'address',
                  value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                },
                {
                  name: 'value',
                  type: 'uint256',
                  value: '40000000000000000000000',
                },
              ],
            },
            confirmationsRequired: 2,
            confirmations: [
              {
                owner: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                submissionDate: '2024-03-20T09:38:11.479197Z',
                transactionHash: null,
                signature:
                  '0x552b4bfaf92e7486785f6f922975e131f244152613486f2567112913a910047f14a5f5ce410d39192d0fbc7df1d9dc43e7c11b64510d44151dd2712be14665eb1c',
                signatureType: 'EOA',
              },
              {
                owner: '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
                submissionDate: '2024-03-20T09:41:25Z',
                transactionHash: null,
                signature:
                  '0x000000000000000000000000be7d3f723d069a941228e44e222b37fbce0731ce000000000000000000000000000000000000000000000000000000000000000001',
                signatureType: 'APPROVED_HASH',
              },
            ],
            trusted: true,
            signatures:
              '0x000000000000000000000000be7d3f723d069a941228e44e222b37fbce0731ce000000000000000000000000000000000000000000000000000000000000000001552b4bfaf92e7486785f6f922975e131f244152613486f2567112913a910047f14a5f5ce410d39192d0fbc7df1d9dc43e7c11b64510d44151dd2712be14665eb1c',
            transfers: [
              {
                type: 'ERC20_TRANSFER',
                executionDate: '2024-03-20T09:41:25Z',
                blockNumber: 192294646,
                transactionHash:
                  '0x7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f371817813',
                to: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                value: '40000000000000000000000',
                tokenId: null,
                tokenAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                transferId:
                  'e7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f3718178133',
                tokenInfo: {
                  type: 'ERC20',
                  address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                  name: 'Arbitrum',
                  symbol: 'ARB',
                  decimals: 18,
                  logoUri:
                    'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                  trusted: true,
                },
                from: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
              },
            ],
            txType: 'MULTISIG_TRANSACTION',
          },
        ];

        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getAllTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
        const getImitationTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${results[0].transfers[0].tokenAddress}`;
        const getTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${results[1].transfers[0].tokenAddress}`;
        networkService.get.mockImplementation(({ url }) => {
          if (url === getChainUrl) {
            return Promise.resolve({ data: chain, status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: pageBuilder().with('results', results).build(),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: safe, status: 200 });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: results[0].transfers[0].tokenInfo,
              status: 200,
            });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: results[1].transfers[0].tokenInfo,
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=true&imitation=true`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  id: 'transfer_0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4_ef6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb44',
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: '0xFd737d98d9F6b566cc104Fd40aEcC449b8EaA512',
                    },
                    richDecodedInfo: null,
                    sender: {
                      logoUri: null,
                      name: null,
                      value: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
                    },
                    transferInfo: {
                      decimals: 18,
                      imitation: true,
                      logoUri:
                        'https://safe-transaction-assets.safe.global/tokens/logos/0xcDB94376E0330B13F5Becaece169602cbB14399c.png',
                      tokenAddress:
                        '0xcDB94376E0330B13F5Becaece169602cbB14399c',
                      tokenName: 'Arbitrum',
                      tokenSymbol: 'ARB',
                      trusted: true,
                      type: 'ERC20',
                      value: '40000000000000000000000',
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 2,
                    confirmationsSubmitted: 2,
                    missingSigners: null,
                    nonce: 3,
                    type: 'MULTISIG',
                  },
                  id: 'multisig_0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4_0xa0772fe5d26572fa777e0b4557da9a03d208086078215245ed26502f7a7bf683',
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: 'Send 40000 ARB to 0xFd7e...A512',
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                    },
                    richDecodedInfo: {
                      fragments: [
                        {
                          type: 'text',
                          value: 'Send',
                        },
                        {
                          logoUri:
                            'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                          symbol: 'ARB',
                          type: 'tokenValue',
                          value: '40000',
                        },
                        {
                          type: 'text',
                          value: 'to',
                        },
                        {
                          type: 'address',
                          value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                        },
                      ],
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
                    },
                    transferInfo: {
                      decimals: 18,
                      imitation: null,
                      logoUri:
                        'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                      tokenAddress:
                        '0x912CE59144191C1204E64559FE8253a0e49E6548',
                      tokenName: 'Arbitrum',
                      tokenSymbol: 'ARB',
                      trusted: null,
                      type: 'ERC20',
                      value: '40000000000000000000000',
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should filter out outgoing ERC-20 transfers that imitate a direct predecessor', async () => {
        // Example taken from arb1:0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4 - marked as trusted
        const chain = chainBuilder().build();
        const safe = safeBuilder()
          .with('address', '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4')
          .with('owners', [
            '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
            '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
          ])
          .build();

        const results = [
          {
            executionDate: '2024-03-20T09:42:58Z',
            to: '0x0e74DE9501F54610169EDB5D6CC6b559d403D4B7',
            data: '0x12514bba00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000cdb94376e0330b13f5becaece169602cbb14399c000000000000000000000000a52cd97c022e5373ee305010ff2263d29bb87a7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009a6de84bf23ed9ba92bdb8027037975ef181b1c4000000000000000000000000345e400b58fbc0f9bc0eb176b6a125f35056ac300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fd737d98d9f6b566cc104fd40aecc449b8eaa5120000000000000000000000001b4b73713ada8a6f864b58d0dd6099ca54e59aa30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000878678326eac90000000000000000000000000000000000000000000000000000000000000001ed02f00000000000000000000000000000000000000000000000000000000000000000',
            txHash:
              '0xf6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb4',
            blockNumber: 192295013,
            transfers: [
              {
                type: 'ERC20_TRANSFER',
                executionDate: '2024-03-20T09:42:58Z',
                blockNumber: 192295013,
                transactionHash:
                  '0xf6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb4',
                to: '0xFd737d98d9F6b566cc104Fd40aEcC449b8EaA512',
                value: '40000000000000000000000',
                tokenId: null,
                tokenAddress: '0xcDB94376E0330B13F5Becaece169602cbB14399c',
                transferId:
                  'ef6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb44',
                tokenInfo: {
                  type: 'ERC20',
                  address: '0xcDB94376E0330B13F5Becaece169602cbB14399c',
                  name: 'Arbitrum',
                  symbol: 'ARB',
                  decimals: 18,
                  logoUri:
                    'https://safe-transaction-assets.safe.global/tokens/logos/0xcDB94376E0330B13F5Becaece169602cbB14399c.png',
                  trusted: true,
                },
                from: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
              },
            ],
            txType: 'ETHEREUM_TRANSACTION',
            from: '0xA504C7e72AD25927EbFA6ea14aD5EA56fb0aB64a',
          },
          {
            safe: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
            to: '0x912CE59144191C1204E64559FE8253a0e49E6548',
            value: '0',
            data: '0xa9059cbb000000000000000000000000fd7e78798f312a29bb03133de9d26e151d3aa512000000000000000000000000000000000000000000000878678326eac9000000',
            operation: 0,
            gasToken: '0x0000000000000000000000000000000000000000',
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: '0',
            refundReceiver: '0x0000000000000000000000000000000000000000',
            nonce: 3,
            executionDate: '2024-03-20T09:41:25Z',
            submissionDate: '2024-03-20T09:38:11.447366Z',
            modified: '2024-03-20T09:41:25Z',
            blockNumber: 192294646,
            transactionHash:
              '0x7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f371817813',
            safeTxHash:
              '0xa0772fe5d26572fa777e0b4557da9a03d208086078215245ed26502f7a7bf683',
            proposer: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
            executor: '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
            isExecuted: true,
            isSuccessful: true,
            ethGasPrice: '10946000',
            maxFeePerGas: null,
            maxPriorityFeePerGas: null,
            gasUsed: 249105,
            fee: '2726703330000',
            origin: '{}',
            dataDecoded: {
              method: 'transfer',
              parameters: [
                {
                  name: 'to',
                  type: 'address',
                  value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                },
                {
                  name: 'value',
                  type: 'uint256',
                  value: '40000000000000000000000',
                },
              ],
            },
            confirmationsRequired: 2,
            confirmations: [
              {
                owner: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                submissionDate: '2024-03-20T09:38:11.479197Z',
                transactionHash: null,
                signature:
                  '0x552b4bfaf92e7486785f6f922975e131f244152613486f2567112913a910047f14a5f5ce410d39192d0fbc7df1d9dc43e7c11b64510d44151dd2712be14665eb1c',
                signatureType: 'EOA',
              },
              {
                owner: '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
                submissionDate: '2024-03-20T09:41:25Z',
                transactionHash: null,
                signature:
                  '0x000000000000000000000000be7d3f723d069a941228e44e222b37fbce0731ce000000000000000000000000000000000000000000000000000000000000000001',
                signatureType: 'APPROVED_HASH',
              },
            ],
            trusted: true,
            signatures:
              '0x000000000000000000000000be7d3f723d069a941228e44e222b37fbce0731ce000000000000000000000000000000000000000000000000000000000000000001552b4bfaf92e7486785f6f922975e131f244152613486f2567112913a910047f14a5f5ce410d39192d0fbc7df1d9dc43e7c11b64510d44151dd2712be14665eb1c',
            transfers: [
              {
                type: 'ERC20_TRANSFER',
                executionDate: '2024-03-20T09:41:25Z',
                blockNumber: 192294646,
                transactionHash:
                  '0x7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f371817813',
                to: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                value: '40000000000000000000000',
                tokenId: null,
                tokenAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                transferId:
                  'e7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f3718178133',
                tokenInfo: {
                  type: 'ERC20',
                  address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                  name: 'Arbitrum',
                  symbol: 'ARB',
                  decimals: 18,
                  logoUri:
                    'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                  trusted: true,
                },
                from: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
              },
            ],
            txType: 'MULTISIG_TRANSACTION',
          },
        ];

        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getAllTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
        const getImitationTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${results[0].transfers[0].tokenAddress}`;
        const getTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${results[1].transfers[0].tokenAddress}`;
        networkService.get.mockImplementation(({ url }) => {
          if (url === getChainUrl) {
            return Promise.resolve({ data: chain, status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: pageBuilder().with('results', results).build(),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: safe, status: 200 });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: results[0].transfers[0].tokenInfo,
              status: 200,
            });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: results[1].transfers[0].tokenInfo,
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=true`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927685000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 2,
                    confirmationsSubmitted: 2,
                    missingSigners: null,
                    nonce: 3,
                    type: 'MULTISIG',
                  },
                  id: 'multisig_0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4_0xa0772fe5d26572fa777e0b4557da9a03d208086078215245ed26502f7a7bf683',
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: 'Send 40000 ARB to 0xFd7e...A512',
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                    },
                    richDecodedInfo: {
                      fragments: [
                        {
                          type: 'text',
                          value: 'Send',
                        },
                        {
                          logoUri:
                            'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                          symbol: 'ARB',
                          type: 'tokenValue',
                          value: '40000',
                        },
                        {
                          type: 'text',
                          value: 'to',
                        },
                        {
                          type: 'address',
                          value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                        },
                      ],
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
                    },
                    transferInfo: {
                      decimals: 18,
                      imitation: null,
                      logoUri:
                        'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                      tokenAddress:
                        '0x912CE59144191C1204E64559FE8253a0e49E6548',
                      tokenName: 'Arbitrum',
                      tokenSymbol: 'ARB',
                      trusted: null,
                      type: 'ERC20',
                      value: '40000000000000000000000',
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });
    });

    describe('Non-trusted tokens', () => {
      it('should flag outgoing ERC-20 transfers that imitate a direct predecessor', async () => {
        // Example taken from arb1:0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4
        const chain = chainBuilder().build();
        const safe = safeBuilder()
          .with('address', '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4')
          .with('owners', [
            '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
            '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
          ])
          .build();

        const results = [
          {
            executionDate: '2024-03-20T09:42:58Z',
            to: '0x0e74DE9501F54610169EDB5D6CC6b559d403D4B7',
            data: '0x12514bba00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000cdb94376e0330b13f5becaece169602cbb14399c000000000000000000000000a52cd97c022e5373ee305010ff2263d29bb87a7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009a6de84bf23ed9ba92bdb8027037975ef181b1c4000000000000000000000000345e400b58fbc0f9bc0eb176b6a125f35056ac300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fd737d98d9f6b566cc104fd40aecc449b8eaa5120000000000000000000000001b4b73713ada8a6f864b58d0dd6099ca54e59aa30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000878678326eac90000000000000000000000000000000000000000000000000000000000000001ed02f00000000000000000000000000000000000000000000000000000000000000000',
            txHash:
              '0xf6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb4',
            blockNumber: 192295013,
            transfers: [
              {
                type: 'ERC20_TRANSFER',
                executionDate: '2024-03-20T09:42:58Z',
                blockNumber: 192295013,
                transactionHash:
                  '0xf6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb4',
                to: '0xFd737d98d9F6b566cc104Fd40aEcC449b8EaA512',
                value: '40000000000000000000000',
                tokenId: null,
                tokenAddress: '0xcDB94376E0330B13F5Becaece169602cbB14399c',
                transferId:
                  'ef6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb44',
                tokenInfo: {
                  type: 'ERC20',
                  address: '0xcDB94376E0330B13F5Becaece169602cbB14399c',
                  name: 'Arbitrum',
                  symbol: 'ARB',
                  decimals: 18,
                  logoUri:
                    'https://safe-transaction-assets.safe.global/tokens/logos/0xcDB94376E0330B13F5Becaece169602cbB14399c.png',
                  trusted: false,
                },
                from: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
              },
            ],
            txType: 'ETHEREUM_TRANSACTION',
            from: '0xA504C7e72AD25927EbFA6ea14aD5EA56fb0aB64a',
          },
          {
            safe: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
            to: '0x912CE59144191C1204E64559FE8253a0e49E6548',
            value: '0',
            data: '0xa9059cbb000000000000000000000000fd7e78798f312a29bb03133de9d26e151d3aa512000000000000000000000000000000000000000000000878678326eac9000000',
            operation: 0,
            gasToken: '0x0000000000000000000000000000000000000000',
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: '0',
            refundReceiver: '0x0000000000000000000000000000000000000000',
            nonce: 3,
            executionDate: '2024-03-20T09:41:25Z',
            submissionDate: '2024-03-20T09:38:11.447366Z',
            modified: '2024-03-20T09:41:25Z',
            blockNumber: 192294646,
            transactionHash:
              '0x7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f371817813',
            safeTxHash:
              '0xa0772fe5d26572fa777e0b4557da9a03d208086078215245ed26502f7a7bf683',
            proposer: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
            executor: '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
            isExecuted: true,
            isSuccessful: true,
            ethGasPrice: '10946000',
            maxFeePerGas: null,
            maxPriorityFeePerGas: null,
            gasUsed: 249105,
            fee: '2726703330000',
            origin: '{}',
            dataDecoded: {
              method: 'transfer',
              parameters: [
                {
                  name: 'to',
                  type: 'address',
                  value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                },
                {
                  name: 'value',
                  type: 'uint256',
                  value: '40000000000000000000000',
                },
              ],
            },
            confirmationsRequired: 2,
            confirmations: [
              {
                owner: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                submissionDate: '2024-03-20T09:38:11.479197Z',
                transactionHash: null,
                signature:
                  '0x552b4bfaf92e7486785f6f922975e131f244152613486f2567112913a910047f14a5f5ce410d39192d0fbc7df1d9dc43e7c11b64510d44151dd2712be14665eb1c',
                signatureType: 'EOA',
              },
              {
                owner: '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
                submissionDate: '2024-03-20T09:41:25Z',
                transactionHash: null,
                signature:
                  '0x000000000000000000000000be7d3f723d069a941228e44e222b37fbce0731ce000000000000000000000000000000000000000000000000000000000000000001',
                signatureType: 'APPROVED_HASH',
              },
            ],
            trusted: true,
            signatures:
              '0x000000000000000000000000be7d3f723d069a941228e44e222b37fbce0731ce000000000000000000000000000000000000000000000000000000000000000001552b4bfaf92e7486785f6f922975e131f244152613486f2567112913a910047f14a5f5ce410d39192d0fbc7df1d9dc43e7c11b64510d44151dd2712be14665eb1c',
            transfers: [
              {
                type: 'ERC20_TRANSFER',
                executionDate: '2024-03-20T09:41:25Z',
                blockNumber: 192294646,
                transactionHash:
                  '0x7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f371817813',
                to: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                value: '40000000000000000000000',
                tokenId: null,
                tokenAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                transferId:
                  'e7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f3718178133',
                tokenInfo: {
                  type: 'ERC20',
                  address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                  name: 'Arbitrum',
                  symbol: 'ARB',
                  decimals: 18,
                  logoUri:
                    'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                  trusted: false,
                },
                from: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
              },
            ],
            txType: 'MULTISIG_TRANSACTION',
          },
        ];

        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getAllTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
        const getImitationTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${results[0].transfers[0].tokenAddress}`;
        const getTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${results[1].transfers[0].tokenAddress}`;
        networkService.get.mockImplementation(({ url }) => {
          if (url === getChainUrl) {
            return Promise.resolve({ data: chain, status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: pageBuilder().with('results', results).build(),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: safe, status: 200 });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: results[0].transfers[0].tokenInfo,
              status: 200,
            });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: results[1].transfers[0].tokenInfo,
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false&imitation=true`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  id: 'transfer_0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4_ef6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb44',
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: '0xFd737d98d9F6b566cc104Fd40aEcC449b8EaA512',
                    },
                    richDecodedInfo: null,
                    sender: {
                      logoUri: null,
                      name: null,
                      value: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
                    },
                    transferInfo: {
                      decimals: 18,
                      imitation: true,
                      logoUri:
                        'https://safe-transaction-assets.safe.global/tokens/logos/0xcDB94376E0330B13F5Becaece169602cbB14399c.png',
                      tokenAddress:
                        '0xcDB94376E0330B13F5Becaece169602cbB14399c',
                      tokenName: 'Arbitrum',
                      tokenSymbol: 'ARB',
                      trusted: false,
                      type: 'ERC20',
                      value: '40000000000000000000000',
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 2,
                    confirmationsSubmitted: 2,
                    missingSigners: null,
                    nonce: 3,
                    type: 'MULTISIG',
                  },
                  id: 'multisig_0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4_0xa0772fe5d26572fa777e0b4557da9a03d208086078215245ed26502f7a7bf683',
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: 'Send 40000 ARB to 0xFd7e...A512',
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                    },
                    richDecodedInfo: {
                      fragments: [
                        {
                          type: 'text',
                          value: 'Send',
                        },
                        {
                          logoUri:
                            'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                          symbol: 'ARB',
                          type: 'tokenValue',
                          value: '40000',
                        },
                        {
                          type: 'text',
                          value: 'to',
                        },
                        {
                          type: 'address',
                          value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                        },
                      ],
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
                    },
                    transferInfo: {
                      decimals: 18,
                      imitation: null,
                      logoUri:
                        'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                      tokenAddress:
                        '0x912CE59144191C1204E64559FE8253a0e49E6548',
                      tokenName: 'Arbitrum',
                      tokenSymbol: 'ARB',
                      trusted: null,
                      type: 'ERC20',
                      value: '40000000000000000000000',
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should filter out outgoing ERC-20 transfers that imitate a direct predecessor', async () => {
        // Example taken from arb1:0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4
        const chain = chainBuilder().build();
        const safe = safeBuilder()
          .with('address', '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4')
          .with('owners', [
            '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
            '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
          ])
          .build();

        const results = [
          {
            executionDate: '2024-03-20T09:42:58Z',
            to: '0x0e74DE9501F54610169EDB5D6CC6b559d403D4B7',
            data: '0x12514bba00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000cdb94376e0330b13f5becaece169602cbb14399c000000000000000000000000a52cd97c022e5373ee305010ff2263d29bb87a7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009a6de84bf23ed9ba92bdb8027037975ef181b1c4000000000000000000000000345e400b58fbc0f9bc0eb176b6a125f35056ac300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fd737d98d9f6b566cc104fd40aecc449b8eaa5120000000000000000000000001b4b73713ada8a6f864b58d0dd6099ca54e59aa30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000878678326eac90000000000000000000000000000000000000000000000000000000000000001ed02f00000000000000000000000000000000000000000000000000000000000000000',
            txHash:
              '0xf6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb4',
            blockNumber: 192295013,
            transfers: [
              {
                type: 'ERC20_TRANSFER',
                executionDate: '2024-03-20T09:42:58Z',
                blockNumber: 192295013,
                transactionHash:
                  '0xf6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb4',
                to: '0xFd737d98d9F6b566cc104Fd40aEcC449b8EaA512',
                value: '40000000000000000000000',
                tokenId: null,
                tokenAddress: '0xcDB94376E0330B13F5Becaece169602cbB14399c',
                transferId:
                  'ef6ab60f4e79f01e6f9615aa134725d5fe0d7222b47a441fff6233f9219593bb44',
                tokenInfo: {
                  type: 'ERC20',
                  address: '0xcDB94376E0330B13F5Becaece169602cbB14399c',
                  name: 'Arbitrum',
                  symbol: 'ARB',
                  decimals: 18,
                  logoUri:
                    'https://safe-transaction-assets.safe.global/tokens/logos/0xcDB94376E0330B13F5Becaece169602cbB14399c.png',
                  trusted: false,
                },
                from: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
              },
            ],
            txType: 'ETHEREUM_TRANSACTION',
            from: '0xA504C7e72AD25927EbFA6ea14aD5EA56fb0aB64a',
          },
          {
            safe: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
            to: '0x912CE59144191C1204E64559FE8253a0e49E6548',
            value: '0',
            data: '0xa9059cbb000000000000000000000000fd7e78798f312a29bb03133de9d26e151d3aa512000000000000000000000000000000000000000000000878678326eac9000000',
            operation: 0,
            gasToken: '0x0000000000000000000000000000000000000000',
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: '0',
            refundReceiver: '0x0000000000000000000000000000000000000000',
            nonce: 3,
            executionDate: '2024-03-20T09:41:25Z',
            submissionDate: '2024-03-20T09:38:11.447366Z',
            modified: '2024-03-20T09:41:25Z',
            blockNumber: 192294646,
            transactionHash:
              '0x7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f371817813',
            safeTxHash:
              '0xa0772fe5d26572fa777e0b4557da9a03d208086078215245ed26502f7a7bf683',
            proposer: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
            executor: '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
            isExecuted: true,
            isSuccessful: true,
            ethGasPrice: '10946000',
            maxFeePerGas: null,
            maxPriorityFeePerGas: null,
            gasUsed: 249105,
            fee: '2726703330000',
            origin: '{}',
            dataDecoded: {
              method: 'transfer',
              parameters: [
                {
                  name: 'to',
                  type: 'address',
                  value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                },
                {
                  name: 'value',
                  type: 'uint256',
                  value: '40000000000000000000000',
                },
              ],
            },
            confirmationsRequired: 2,
            confirmations: [
              {
                owner: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                submissionDate: '2024-03-20T09:38:11.479197Z',
                transactionHash: null,
                signature:
                  '0x552b4bfaf92e7486785f6f922975e131f244152613486f2567112913a910047f14a5f5ce410d39192d0fbc7df1d9dc43e7c11b64510d44151dd2712be14665eb1c',
                signatureType: 'EOA',
              },
              {
                owner: '0xBE7d3f723d069a941228e44e222b37fBCe0731ce',
                submissionDate: '2024-03-20T09:41:25Z',
                transactionHash: null,
                signature:
                  '0x000000000000000000000000be7d3f723d069a941228e44e222b37fbce0731ce000000000000000000000000000000000000000000000000000000000000000001',
                signatureType: 'APPROVED_HASH',
              },
            ],
            trusted: true,
            signatures:
              '0x000000000000000000000000be7d3f723d069a941228e44e222b37fbce0731ce000000000000000000000000000000000000000000000000000000000000000001552b4bfaf92e7486785f6f922975e131f244152613486f2567112913a910047f14a5f5ce410d39192d0fbc7df1d9dc43e7c11b64510d44151dd2712be14665eb1c',
            transfers: [
              {
                type: 'ERC20_TRANSFER',
                executionDate: '2024-03-20T09:41:25Z',
                blockNumber: 192294646,
                transactionHash:
                  '0x7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f371817813',
                to: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                value: '40000000000000000000000',
                tokenId: null,
                tokenAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                transferId:
                  'e7e60c76bb3b350dc552f3c261faf7dcdbfe141f7a740d9495efd49f3718178133',
                tokenInfo: {
                  type: 'ERC20',
                  address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                  name: 'Arbitrum',
                  symbol: 'ARB',
                  decimals: 18,
                  logoUri:
                    'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                  trusted: false,
                },
                from: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
              },
            ],
            txType: 'MULTISIG_TRANSACTION',
          },
        ];

        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getAllTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
        const getImitationTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${results[0].transfers[0].tokenAddress}`;
        const getTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${results[1].transfers[0].tokenAddress}`;
        networkService.get.mockImplementation(({ url }) => {
          if (url === getChainUrl) {
            return Promise.resolve({ data: chain, status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: pageBuilder().with('results', results).build(),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: safe, status: 200 });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: results[0].transfers[0].tokenInfo,
              status: 200,
            });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: results[1].transfers[0].tokenInfo,
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927685000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 2,
                    confirmationsSubmitted: 2,
                    missingSigners: null,
                    nonce: 3,
                    type: 'MULTISIG',
                  },
                  id: 'multisig_0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4_0xa0772fe5d26572fa777e0b4557da9a03d208086078215245ed26502f7a7bf683',
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: 'Send 40000 ARB to 0xFd7e...A512',
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                    },
                    richDecodedInfo: {
                      fragments: [
                        {
                          type: 'text',
                          value: 'Send',
                        },
                        {
                          logoUri:
                            'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                          symbol: 'ARB',
                          type: 'tokenValue',
                          value: '40000',
                        },
                        {
                          type: 'text',
                          value: 'to',
                        },
                        {
                          type: 'address',
                          value: '0xFd7e78798f312A29bb03133de9D26E151D3aA512',
                        },
                      ],
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
                    },
                    transferInfo: {
                      decimals: 18,
                      imitation: null,
                      logoUri:
                        'https://safe-transaction-assets.safe.global/tokens/logos/0x912CE59144191C1204E64559FE8253a0e49E6548.png',
                      tokenAddress:
                        '0x912CE59144191C1204E64559FE8253a0e49E6548',
                      tokenName: 'Arbitrum',
                      tokenSymbol: 'ARB',
                      trusted: null,
                      type: 'ERC20',
                      value: '40000000000000000000000',
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });
    });
  });
});
