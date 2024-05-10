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
import { Server } from 'net';

describe('Transactions History Controller (Unit)', () => {
  let app: INestApplication<Server>;
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
        imitationTransactions: {
          prefixLength,
          suffixLength,
        },
        features: {
          imitationFiltering: true,
        },
        history: {
          maxNestedTransfers: 5,
        },
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
          ).length,
        ).toBe(maxNestedTransfers);
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
    it('should filter out outgoing ERC-20 transfers that imitate a predecessor', async () => {
      // Example taken from arb1:0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4
      const chain = chainBuilder().build();
      const safe = safeBuilder()
        .with('address', '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4')
        .with('owners', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
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
              owner: safe.owners[0],
              submissionDate: '2024-03-20T09:38:11.479197Z',
              transactionHash: null,
              signature:
                '0x552b4bfaf92e7486785f6f922975e131f244152613486f2567112913a910047f14a5f5ce410d39192d0fbc7df1d9dc43e7c11b64510d44151dd2712be14665eb1c',
              signatureType: 'EOA',
            },
            {
              owner: safe.owners[1],
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
        {
          executionDate: '2024-03-20T09:18:32Z',
          to: '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D',
          data: '0x8d80ff0a00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000d0b00b6fd0bdb1432b2c77170933120079f436f3bb4fa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003046a761202000000000000000000000000912ce59144191c1204e64559fe8253a0e49e65480000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000044a9059cbb00000000000000000000000088103c9fa3ce4ff45e4c1ea3688f40d1dfda6b020000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010458560018b40606d8124f87297277bbaba0a90b1698370a3803003e716faffa5e443a38e4cec966ae7c438b3e1eebc2a1ad123ea3f8c5380226e879dc5d5818c61b2bd037179d9b51523878f40d3ce1e962d0678daee85ecb0eebdeb569431069c0061e6e079e6d96d1ada98486c9afc99b3b628c459b6fe6d325b38d717ccc3dfa1be5d55404dc15e26effef3d0062dda6c8ac3dd03cdeb2895b2843d78dd1ab5f462db04cff3862a657b12c0667939b6787c57e3df495063542cbb7ce9c2d260f921c98bcb9b2f48e105e7b16dc6099ab0bbbc1daea62e4c76037865cba25fafec3916bbb49ca21866837adb6c1edcc52b820375f359b8d35cb595bd09c26ceda99a01c0000000000000000000000000000000000000000000000000000000000b6fd0bdb1432b2c77170933120079f436f3bb4fa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006046a76120200000000000000000000000040a2accbd92bca938b02010e17a5b8929b49130d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004c000000000000000000000000000000000000000000000000000000000000003448d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000002fd00912ce59144191c1204e64559fe8253a0e49e654800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb0000000000000000000000009aab7a39e7e022666283454fbd0769f93d1e1d4e000000000000000000000000000000000000000000000cb49b44ba602d80000000912ce59144191c1204e64559fe8253a0e49e654800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000d3fb3ed59e5a7674003625241551a6ffa63d2c5000000000000000000000000000000000000000000000054b40b1f852bda0000000912ce59144191c1204e64559fe8253a0e49e654800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb0000000000000000000000009a6de84bf23ed9ba92bdb8027037975ef181b1c4000000000000000000000000000000000000000000000878678326eac900000000912ce59144191c1204e64559fe8253a0e49e654800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000e7eb925300075e49fc5caad5d408a50dd22f92d60000000000000000000000000000000000000000000007695a92c20d6fe0000000912ce59144191c1204e64559fe8253a0e49e654800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000bc22b72b0408f66316cc4ee562b858f612776f1400000000000000000000000000000000000000000000054b40b1f852bda0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010425a901b70e415dac6bb78079fc99542d64f9bd5c48823ca0e477d1520d9432254543fa9b814ae03f0f9b74455ee56369d84af999c8462836dd8f39c1b897492f1b3ea25052c6862fc7dfb50b4413a45c14192db85953ee526c022ed35fa43f09c41bb42349464e2e6b2065eda02b88ea80ddc6a2ea3e7125a482fc2ee926661f481c0f25744eb8f7eacf544d17ff8478154e6ab368f4ca0ba0e0f476d5357b28704b4d1263a4c32980cbb013ce893ca9532035e3d2f1c70b6e47e2af49bafda4e9261b023b000c217058732b3bdb2ca73012e2cac856bcd0c9d89336086787dbcaa1985c81f89812e7addd5d7dcd807e14e4bb986d24dbc6ad152796937882d626e6cf1b0000000000000000000000000000000000000000000000000000000000b6fd0bdb1432b2c77170933120079f436f3bb4fa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003046a761202000000000000000000000000912ce59144191c1204e64559fe8253a0e49e65480000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000044a9059cbb0000000000000000000000008704ee9ab8622bbc25410c7d4717ed51f776c7f600000000000000000000000000000000000000000000a1fd44f903579c9400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001042f486e77e4441a2849f295d7615a237417cb9aa94b86cab0c506df9ff8bf18bb13b14a3eb00eb0be707251e21e63283345c951aebd5b9d4eda11ba80223bee861cbd125cbd373edfe7bde69d5382c83d731a587313c473eb8db1ef508f38fb73f5783f09bfa4fe2101c6aec6a22d680edc0e4c13c27dc3eb8ace6ac5a9ac415a781ba117d4d16c977474f442ae6ceb64e3256e31a3acdd9b5bbdc407595a66d521b24458ec59290deaa2fd5e5d68257e653f4ae9d13b22689e90626911324aa1c7631c80b42babdb8705106ac64f3229e18738926786cef4df39831148f330bb5fd78f6be889ba310c7f346d82a62b00cd0acc5a404731e0713a32839077746701a45b1c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          txHash:
            '0x85f22020966cb63356fedb6e12210474eb42052fa252cbf4d64182a2607169f6',
          blockNumber: 192289077,
          transfers: [
            {
              type: 'ERC20_TRANSFER',
              executionDate: '2024-03-20T09:18:32Z',
              blockNumber: 192289077,
              transactionHash:
                '0x85f22020966cb63356fedb6e12210474eb42052fa252cbf4d64182a2607169f6',
              to: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
              value: '40000000000000000000000',
              tokenId: null,
              tokenAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
              transferId:
                'e85f22020966cb63356fedb6e12210474eb42052fa252cbf4d64182a2607169f66',
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
              from: '0xB6fd0BDb1432b2c77170933120079f436F3bB4fa',
            },
          ],
          txType: 'ETHEREUM_TRANSACTION',
          from: '0xFb390aC2028B47031FA4561994fd3abc9FD60a7f',
        },
      ];

      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
        const getImitationTokenAddress = `${chain.transactionService}/api/v1/tokens/${results[0].transfers[0].tokenAddress}`;
        const getLegitTokenAddress = `${chain.transactionService}/api/v1/tokens/${results[1].transfers[0].tokenAddress}`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === getAllTransactions) {
          return Promise.resolve({
            data: pageBuilder().with('results', results).build(),
            status: 200,
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({ data: safe, status: 200 });
        }
        if (url === getImitationTokenAddress) {
          return Promise.resolve({
            data: results[0].transfers[0].tokenInfo,
            status: 200,
          });
        }
        if (url === getLegitTokenAddress) {
          return Promise.resolve({
            data: results[1].transfers[0].tokenAddress,
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
              type: 'DATE_LABEL',
              timestamp: 1710927685000,
            },
            // Only the legitimate transaction (results[1]) should be included as results[0] is imitation
            // and results[2] is fetched in order to calculate conflict DATE_LABEL
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
                  actionCount: null,
                  dataSize: '68',
                  humanDescription:
                    'Send 40000000000000000000000 to 0xFd7e...A512',
                  isCancellation: false,
                  methodName: 'transfer',
                  richDecodedInfo: {
                    fragments: [
                      {
                        type: 'text',
                        value: 'Send',
                      },
                      {
                        logoUri: null,
                        symbol: null,
                        type: 'tokenValue',
                        value: '40000000000000000000000',
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
                  to: {
                    logoUri: null,
                    name: null,
                    value: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                  },
                  type: 'Custom',
                  value: '0',
                },
                txStatus: 'SUCCESS',
              },
              type: 'TRANSACTION',
            },
          ]);
        });
    });

    it('should not filter imitation transfers if untrusted those untrusted are requested', async () => {
      // Example taken from arb1:0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4
      const chain = chainBuilder().build();
      const safe = safeBuilder()
        .with('address', '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4')
        .with('owners', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
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
              owner: safe.owners[0],
              submissionDate: '2024-03-20T09:38:11.479197Z',
              transactionHash: null,
              signature:
                '0x552b4bfaf92e7486785f6f922975e131f244152613486f2567112913a910047f14a5f5ce410d39192d0fbc7df1d9dc43e7c11b64510d44151dd2712be14665eb1c',
              signatureType: 'EOA',
            },
            {
              owner: safe.owners[1],
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
        {
          executionDate: '2024-03-20T09:18:32Z',
          to: '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D',
          data: '0x8d80ff0a00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000d0b00b6fd0bdb1432b2c77170933120079f436f3bb4fa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003046a761202000000000000000000000000912ce59144191c1204e64559fe8253a0e49e65480000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000044a9059cbb00000000000000000000000088103c9fa3ce4ff45e4c1ea3688f40d1dfda6b020000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010458560018b40606d8124f87297277bbaba0a90b1698370a3803003e716faffa5e443a38e4cec966ae7c438b3e1eebc2a1ad123ea3f8c5380226e879dc5d5818c61b2bd037179d9b51523878f40d3ce1e962d0678daee85ecb0eebdeb569431069c0061e6e079e6d96d1ada98486c9afc99b3b628c459b6fe6d325b38d717ccc3dfa1be5d55404dc15e26effef3d0062dda6c8ac3dd03cdeb2895b2843d78dd1ab5f462db04cff3862a657b12c0667939b6787c57e3df495063542cbb7ce9c2d260f921c98bcb9b2f48e105e7b16dc6099ab0bbbc1daea62e4c76037865cba25fafec3916bbb49ca21866837adb6c1edcc52b820375f359b8d35cb595bd09c26ceda99a01c0000000000000000000000000000000000000000000000000000000000b6fd0bdb1432b2c77170933120079f436f3bb4fa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006046a76120200000000000000000000000040a2accbd92bca938b02010e17a5b8929b49130d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004c000000000000000000000000000000000000000000000000000000000000003448d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000002fd00912ce59144191c1204e64559fe8253a0e49e654800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb0000000000000000000000009aab7a39e7e022666283454fbd0769f93d1e1d4e000000000000000000000000000000000000000000000cb49b44ba602d80000000912ce59144191c1204e64559fe8253a0e49e654800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000d3fb3ed59e5a7674003625241551a6ffa63d2c5000000000000000000000000000000000000000000000054b40b1f852bda0000000912ce59144191c1204e64559fe8253a0e49e654800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb0000000000000000000000009a6de84bf23ed9ba92bdb8027037975ef181b1c4000000000000000000000000000000000000000000000878678326eac900000000912ce59144191c1204e64559fe8253a0e49e654800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000e7eb925300075e49fc5caad5d408a50dd22f92d60000000000000000000000000000000000000000000007695a92c20d6fe0000000912ce59144191c1204e64559fe8253a0e49e654800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000bc22b72b0408f66316cc4ee562b858f612776f1400000000000000000000000000000000000000000000054b40b1f852bda0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010425a901b70e415dac6bb78079fc99542d64f9bd5c48823ca0e477d1520d9432254543fa9b814ae03f0f9b74455ee56369d84af999c8462836dd8f39c1b897492f1b3ea25052c6862fc7dfb50b4413a45c14192db85953ee526c022ed35fa43f09c41bb42349464e2e6b2065eda02b88ea80ddc6a2ea3e7125a482fc2ee926661f481c0f25744eb8f7eacf544d17ff8478154e6ab368f4ca0ba0e0f476d5357b28704b4d1263a4c32980cbb013ce893ca9532035e3d2f1c70b6e47e2af49bafda4e9261b023b000c217058732b3bdb2ca73012e2cac856bcd0c9d89336086787dbcaa1985c81f89812e7addd5d7dcd807e14e4bb986d24dbc6ad152796937882d626e6cf1b0000000000000000000000000000000000000000000000000000000000b6fd0bdb1432b2c77170933120079f436f3bb4fa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003046a761202000000000000000000000000912ce59144191c1204e64559fe8253a0e49e65480000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000044a9059cbb0000000000000000000000008704ee9ab8622bbc25410c7d4717ed51f776c7f600000000000000000000000000000000000000000000a1fd44f903579c9400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001042f486e77e4441a2849f295d7615a237417cb9aa94b86cab0c506df9ff8bf18bb13b14a3eb00eb0be707251e21e63283345c951aebd5b9d4eda11ba80223bee861cbd125cbd373edfe7bde69d5382c83d731a587313c473eb8db1ef508f38fb73f5783f09bfa4fe2101c6aec6a22d680edc0e4c13c27dc3eb8ace6ac5a9ac415a781ba117d4d16c977474f442ae6ceb64e3256e31a3acdd9b5bbdc407595a66d521b24458ec59290deaa2fd5e5d68257e653f4ae9d13b22689e90626911324aa1c7631c80b42babdb8705106ac64f3229e18738926786cef4df39831148f330bb5fd78f6be889ba310c7f346d82a62b00cd0acc5a404731e0713a32839077746701a45b1c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          txHash:
            '0x85f22020966cb63356fedb6e12210474eb42052fa252cbf4d64182a2607169f6',
          blockNumber: 192289077,
          transfers: [
            {
              type: 'ERC20_TRANSFER',
              executionDate: '2024-03-20T09:18:32Z',
              blockNumber: 192289077,
              transactionHash:
                '0x85f22020966cb63356fedb6e12210474eb42052fa252cbf4d64182a2607169f6',
              to: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
              value: '40000000000000000000000',
              tokenId: null,
              tokenAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
              transferId:
                'e85f22020966cb63356fedb6e12210474eb42052fa252cbf4d64182a2607169f66',
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
              from: '0xB6fd0BDb1432b2c77170933120079f436F3bB4fa',
            },
          ],
          txType: 'ETHEREUM_TRANSACTION',
          from: '0xFb390aC2028B47031FA4561994fd3abc9FD60a7f',
        },
      ];

      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
        const getImitationTokenAddress = `${chain.transactionService}/api/v1/tokens/${results[0].transfers[0].tokenAddress}`;
        const getLegitTokenAddress = `${chain.transactionService}/api/v1/tokens/${results[1].transfers[0].tokenAddress}`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === getAllTransactions) {
          return Promise.resolve({
            data: pageBuilder().with('results', results).build(),
            status: 200,
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({ data: safe, status: 200 });
        }
        if (url === getImitationTokenAddress) {
          return Promise.resolve({
            data: results[0].transfers[0].tokenInfo,
            status: 200,
          });
        }
        if (url === getLegitTokenAddress) {
          return Promise.resolve({
            data: results[1].transfers[0].tokenAddress,
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
                    logoUri:
                      'https://safe-transaction-assets.safe.global/tokens/logos/0xcDB94376E0330B13F5Becaece169602cbB14399c.png',
                    tokenAddress: '0xcDB94376E0330B13F5Becaece169602cbB14399c',
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
                  actionCount: null,
                  dataSize: '68',
                  humanDescription:
                    'Send 40000000000000000000000 to 0xFd7e...A512',
                  isCancellation: false,
                  methodName: 'transfer',
                  richDecodedInfo: {
                    fragments: [
                      {
                        type: 'text',
                        value: 'Send',
                      },
                      {
                        logoUri: null,
                        symbol: null,
                        type: 'tokenValue',
                        value: '40000000000000000000000',
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
                  to: {
                    logoUri: null,
                    name: null,
                    value: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                  },
                  type: 'Custom',
                  value: '0',
                },
                txStatus: 'SUCCESS',
              },
              type: 'TRANSACTION',
            },
            {
              conflictType: 'None',
              transaction: {
                executionInfo: null,
                id: 'transfer_0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4_e85f22020966cb63356fedb6e12210474eb42052fa252cbf4d64182a2607169f66',
                safeAppInfo: null,
                timestamp: 1710926312000,
                txInfo: {
                  direction: 'INCOMING',
                  humanDescription: null,
                  recipient: {
                    logoUri: null,
                    name: null,
                    value: '0x9a6dE84bF23ed9ba92BDB8027037975ef181b1c4',
                  },
                  richDecodedInfo: null,
                  sender: {
                    logoUri: null,
                    name: null,
                    value: '0xB6fd0BDb1432b2c77170933120079f436F3bB4fa',
                  },
                  transferInfo: {
                    decimals: null,
                    logoUri: null,
                    tokenAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
                    tokenName: null,
                    tokenSymbol: null,
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
