import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { readFileSync } from 'fs';
import * as request from 'supertest';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../domain.module';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionTojson,
} from '../../domain/safe/entities/__tests__/module-transaction.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../domain/safe/entities/__tests__/safe.builder';
import { TransactionsModule } from './transactions.module';
import {
  ethereumTransactionBuilder,
  toJson as ethereumTransactionToJson,
} from '../../domain/safe/entities/__tests__/ethereum-transaction.builder';
import {
  nativeTokenTransferBuilder,
  toJson as nativeTokenTransferToJson,
} from '../../domain/safe/entities/__tests__/native-token-transfer.builder';
import {
  creationTransactionBuilder,
  toJson as creationTransactionToJson,
} from '../../domain/safe/entities/__tests__/creation-transaction.builder';
import { TestAppProvider } from '../../app.provider';

describe('Transactions History Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigApiUrl: string;

  beforeAll(async () => {
    safeConfigApiUrl = faker.internet.url();
    fakeConfigurationService.set('safeConfig.baseUri', safeConfigApiUrl);
    fakeConfigurationService.set('exchange.baseUri', faker.internet.url());
    fakeConfigurationService.set('exchange.apiKey', faker.datatype.uuid());
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        TransactionsModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Failure: Config API fails', async () => {
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      if (url === getChainUrl) {
        return Promise.reject({ status: 500 });
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
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getAllTransactions) {
        return Promise.reject({ status: 500 });
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
    const creationTransactionResponse: any = creationTransactionToJson(
      creationTransactionBuilder().build(),
    );
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getSafeCreationUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/creation/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({ data: transactionHistoryBuilder });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe });
      }
      if (url === getSafeCreationUrl) {
        return Promise.resolve({ data: creationTransactionResponse });
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
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const moduleTransaction = moduleTransactionTojson(
      moduleTransactionBuilder()
        .with('dataDecoded', null)
        .with(
          'executionDate',
          faker.date.between('2022-12-06T00:00:00Z', '2022-12-06T23:59:59Z'),
        )
        .build(),
    );
    const multisigTransaction = multisigTransactionToJson(
      multisigTransactionBuilder()
        .with('dataDecoded', null)
        .with('origin', null)
        .with(
          'executionDate',
          faker.date.between('2022-12-25T00:00:00Z', '2022-12-25T23:59:59Z'),
        )
        .build(),
    );
    const transfer: any = nativeTokenTransferToJson(
      nativeTokenTransferBuilder().build(),
    );
    const incomingTransaction = ethereumTransactionToJson(
      ethereumTransactionBuilder()
        .with(
          'executionDate',
          faker.date.between('2022-12-31T00:00:00Z', '2022-12-31T23:59:59Z'),
        )
        .with('transfers', [transfer])
        .build(),
    );
    const safe = safeBuilder().build();
    const transactionHistoryBuilder = {
      count: 40,
      next: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/?executed=false&limit=10&offset=10&queued=true&trusted=true`,
      previous: null,
      results: [moduleTransaction, multisigTransaction, incomingTransaction],
    };
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({ data: transactionHistoryBuilder });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/`)
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(
          6, //3 date labels and 3 transactions
        );
        expect(body.results[0].timestamp).toEqual(
          1670284800000, // Date('2022-12-06T00:00:00Z').getTime()
        );
        expect(body.results[2].timestamp).toEqual(
          1671926400000, // Date('2022-12-25T00:00:00Z').getTime()
        );
        expect(body.results[4].timestamp).toEqual(
          1672444800000, // Date('2022-12-31T00:00:00Z').getTime(),
        );
      });
  });

  it('Should change date label with time offset', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const timezoneOffset = 3600 * 2; //Offset of 2 hours
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const moduleTransaction = moduleTransactionTojson(
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
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({ data: transactionHistoryBuilder });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe });
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
          new Date('2023-01-01T00:00:00Z').getTime(),
        );
      });
  });

  it('Should return correctly each transaction', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const moduleTransaction: any = getJsonResource(
      'module-transactions/module-transaction-domain.json',
    );
    const multisigTransaction: any = getJsonResource(
      'multisig-transactions/erc20/transfer-source-data.json',
    ).results[0];
    const transfer: any = getJsonResource(
      'incoming-transfers/native-coin/transfer-source-data.json',
    ).results[0];
    const incomingTransaction: any = ethereumTransactionToJson(
      ethereumTransactionBuilder().with('transfers', [transfer]).build(),
    );
    moduleTransaction.txType = 'MODULE_TRANSACTION';
    multisigTransaction.txType = 'MULTISIG_TRANSACTION';
    incomingTransaction.txType = 'ETHEREUM_TRANSACTION';
    const tokenResponse = getJsonResource(
      'multisig-transactions/erc20/token-source-data.json',
    );
    const safe = getJsonResource(
      'incoming-transfers/native-coin/safe-source-data.json',
    );
    const transactionHistoryBuilder = {
      count: 40,
      next: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/?executed=false&limit=10&offset=10&queued=true&trusted=true`,
      previous: null,
      results: [moduleTransaction, multisigTransaction, incomingTransaction],
    };
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({
          data: safe,
        });
      }
      if (url.includes(getTokenUrlPattern)) {
        return Promise.resolve({
          data: tokenResponse,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/`)
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(
          6, //3 date labels and 3 transactions
        );
        expect(body.results[1]).toEqual(
          getJsonResource('module-transactions/expected-response.json')
            .results[0],
        );
        expect(body.results[3]).toEqual(
          getJsonResource('multisig-transactions/erc20/expected-response.json')
            .results[0],
        );
        expect(body.results[5]).toEqual(
          getJsonResource(
            'incoming-transfers/native-coin/expected-response.json',
          ).results[0],
        );
      });
  });

  it('Should include safe creation transaction', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const moduleTransaction: any = moduleTransactionTojson(
      moduleTransactionBuilder().with('dataDecoded', null).build(),
    );
    const safe = safeBuilder().build();
    const allTransactionsResponse = {
      count: 2,
      next: null,
      previous: null,
      results: [moduleTransaction],
    };
    const creationTransactionResponse: any = creationTransactionToJson(
      creationTransactionBuilder()
        .with('created', new Date(moduleTransaction.executionDate))
        .build(),
    );
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrl = `${chainResponse.transactionService}/api/v1/contracts/`;
      const getSafeCreationUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/creation/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: allTransactionsResponse,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({
          data: safe,
        });
      }
      if (url === getSafeCreationUrl) {
        return Promise.resolve({
          data: creationTransactionResponse,
        });
      }
      if (url.includes(getContractUrl)) {
        return Promise.reject({
          detail: 'Not found',
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/`)
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(3);
        expect(body.results[2].transaction.timestamp).toEqual(
          creationTransactionResponse.created.getTime(),
        );
        expect(body.results[2].transaction.txInfo.creator.value).toEqual(
          creationTransactionResponse.creator,
        );
        expect(body.results[2].transaction.txInfo.factory.value).toEqual(
          creationTransactionResponse.factoryAddress,
        );
        expect(body.results[2].transaction.txInfo.implementation.value).toEqual(
          creationTransactionResponse.masterCopy,
        );
        expect(body.results[2].transaction.txInfo.transactionHash).toEqual(
          creationTransactionResponse.transactionHash,
        );
      });
  });

  it('Should keep the client pagination', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const limit = 5;
    const offset = 5;
    const moduleTransaction = moduleTransactionTojson(
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
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({ data: transactionHistoryBuilder });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe });
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

    expect(mockNetworkService.get).toBeCalledWith(
      `${safeConfigApiUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
    expect(mockNetworkService.get).toBeCalledWith(
      `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`,
      {
        params: {
          executed: true,
          offset: offset - 1,
          limit: limit + 1,
          ordering: undefined,
          queued: false,
          safe: safeAddress,
        },
      },
    );
  });
});

const getJsonResource = (relativePath: string) => {
  const basePath = 'src/routes/transactions/__tests__/resources';
  return JSON.parse(readFileSync(`${basePath}/${relativePath}`, 'utf8'));
};
