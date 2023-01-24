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
import { contractBuilder } from '../../domain/contracts/entities/__tests__/contract.builder';
import { MultisigTransaction } from '../../domain/safe/entities/multisig-transaction.entity';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '../../domain/data-decoder/entities/__tests__/data-decoded.builder';
import { safeAppBuilder } from '../../domain/safe-apps/entities/__tests__/safe-app.builder';
import {
  moduleTransactionBuilder,
  toJson,
} from '../../domain/safe/entities/__tests__/module-transaction.builder';
import {
  multisigTransactionBuilder,
  toJson as multiSignToJson,
  toJson as multisigTransactionToJson,
} from '../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../domain/safe/entities/__tests__/safe.builder';
import { DataSourceErrorFilter } from '../common/filters/data-source-error.filter';
import { TransactionsModule } from './transactions.module';

describe('Transactions Controller (Unit)', () => {
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

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new DataSourceErrorFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET multisig transactions by Safe', () => {
    it('Failure: Config API fails', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      mockNetworkService.get.mockRejectedValueOnce({
        status: 500,
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        `${safeConfigApiUrl}/api/v1/chains/${chainId}`,
        undefined,
      );
    });

    it('Failure: Transaction API fails', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockRejectedValueOnce({
        status: 500,
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get).toBeCalledWith(
        `${safeConfigApiUrl}/api/v1/chains/${chainId}`,
        undefined,
      );
      expect(mockNetworkService.get).toBeCalledWith(
        `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`,
        expect.objectContaining({
          params: expect.objectContaining({
            ordering: '-modified',
            safe: safeAddress,
            trusted: true,
          }),
        }),
      );
    });

    it('Failure: data validation fails', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockResolvedValueOnce({
        data: { results: ['invalidData'] },
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });

    it('Should get a ERC20 transfer mapped to the expected format', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
        const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
        const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
        const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chain });
        }
        if (url === getMultisigTransactionsUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'multisig-transactions/erc20/transfer-source-data.json',
            ),
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'multisig-transactions/erc20/safe-source-data.json',
            ),
          });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.reject({
            detail: 'Not found',
          });
        }
        if (url.includes(getTokenUrlPattern)) {
          return Promise.resolve({
            data: getJsonResource(
              'multisig-transactions/erc20/token-source-data.json',
            ),
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual(
            getJsonResource(
              'multisig-transactions/erc20/expected-response.json',
            ),
          );
        });
    });

    it('Should get a ERC721 transfer mapped to the expected format', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
        const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
        const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
        const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
        const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chainResponse });
        }
        if (url === getMultisigTransactionsUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'multisig-transactions/erc721/transfer-source-data.json',
            ),
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'multisig-transactions/erc721/safe-source-data.json',
            ),
          });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.reject({
            detail: 'Not found',
          });
        }
        if (url.includes(getTokenUrlPattern)) {
          return Promise.resolve({
            data: getJsonResource(
              'multisig-transactions/erc721/token-source-data.json',
            ),
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual(
            getJsonResource(
              'multisig-transactions/erc721/expected-response.json',
            ),
          );
        });
    });

    it('Should get a Custom transaction mapped to the expected format', async () => {
      const chainId = faker.random.numeric();
      const chainResponse = chainBuilder().build();
      const safeAppsResponse = [
        safeAppBuilder()
          .with('url', faker.internet.url())
          .with('iconUrl', faker.internet.url())
          .with('name', faker.random.words())
          .build(),
      ];
      const contractResponse = contractBuilder()
        .with('address', faker.finance.ethereumAddress())
        .with('displayName', faker.random.words())
        .with('logoUri', faker.internet.url())
        .build();
      const domainTransaction = multisigTransactionBuilder()
        .with('value', '0')
        .with('data', faker.datatype.hexadecimal(32))
        .with('isExecuted', true)
        .with('isSuccessful', true)
        .with(
          'dataDecoded',
          dataDecodedBuilder()
            .with('method', 'multiSend')
            .with('parameters', [
              dataDecodedParameterBuilder()
                .with('name', 'transactions')
                .with('valueDecoded', [{}, {}, {}])
                .build(),
            ])
            .build(),
        )
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
        const getSafeAppsUrl = `${safeConfigApiUrl}/api/v1/safe-apps/`;
        const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${domainTransaction.safe}/multisig-transactions/`;
        const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${domainTransaction.safe}`;
        const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chainResponse });
        }
        if (url === getSafeAppsUrl) {
          return Promise.resolve({ data: safeAppsResponse });
        }
        if (url === getMultisigTransactionsUrl) {
          return Promise.resolve({
            data: {
              count: 1,
              results: [multisigTransactionToJson(domainTransaction)],
            },
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: safeBuilder().build(),
          });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.resolve({
            data: contractResponse,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/chains/${chainId}/safes/${domainTransaction.safe}/multisig-transactions`,
        )
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual({
            next: null,
            previous: null,
            results: [
              {
                type: 'TRANSACTION',
                transaction: {
                  id: `multisig_${domainTransaction.safe}_${domainTransaction.safeTxHash}`,
                  timestamp: domainTransaction.executionDate?.getTime(),
                  txStatus: 'SUCCESS',
                  txInfo: {
                    type: 'Custom',
                    to: {
                      value: contractResponse.address,
                      name: contractResponse.displayName,
                      logoUri: contractResponse.logoUri,
                    },
                    dataSize: '16',
                    value: domainTransaction.value,
                    methodName: domainTransaction.dataDecoded?.method ?? null,
                    actionCount: 3,
                    isCancellation: false,
                  },
                  executionInfo: {
                    type: 'MULTISIG',
                    nonce: domainTransaction.nonce,
                    confirmationsRequired:
                      domainTransaction.confirmationsRequired,
                    confirmationsSubmitted:
                      domainTransaction.confirmations?.length,
                    missingSigners: null,
                  },
                  safeAppInfo: {
                    logo_uri: safeAppsResponse[0].iconUrl,
                    name: safeAppsResponse[0].name,
                    url: safeAppsResponse[0].url,
                  },
                },
                conflictType: 'None',
              },
            ],
          });
        });
    });
  });

  describe('GET module transactions by Safe', () => {
    it('Failure: Config API fails', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      mockNetworkService.get.mockRejectedValueOnce({
        status: 500,
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/module-transactions`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        `${safeConfigApiUrl}/api/v1/chains/${chainId}`,
        undefined,
      );
    });

    it('Failure: Transaction API fails', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockRejectedValueOnce({
        status: 500,
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/module-transactions`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get).toBeCalledWith(
        `${safeConfigApiUrl}/api/v1/chains/${chainId}`,
        undefined,
      );
    });

    it('Get module transaction should return 404', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockResolvedValueOnce({ data: { results: [] } });
      mockNetworkService.get.mockRejectedValueOnce({
        status: 404,
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/module-transactions`)
        .expect(404)
        .expect({
          message: 'An error occurred',
          code: 404,
        });

      expect(mockNetworkService.get).toBeCalledTimes(3);
      expect(mockNetworkService.get).toBeCalledWith(
        `${safeConfigApiUrl}/api/v1/chains/${chainId}`,
        undefined,
      );
    });

    it('Get module transaction successfully', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const moduleTransaction = {
        count: 2,
        next: null,
        previous: null,
        results: [
          toJson(moduleTransactionBuilder().build()),
          toJson(moduleTransactionBuilder().build()),
        ],
      };

      const safe = safeBuilder().build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockResolvedValueOnce({ data: moduleTransaction });
      mockNetworkService.get.mockResolvedValueOnce({ data: safe });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/module-transactions`)
        .expect(200);
    });
  });

  describe('GET incoming transfers', () => {
    it('Failure: Config API fails', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      mockNetworkService.get.mockRejectedValueOnce({
        status: 500,
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/incoming-transfers`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        `${safeConfigApiUrl}/api/v1/chains/${chainId}`,
        undefined,
      );
    });

    it('Failure: Transaction API fails', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const limit = faker.datatype.number({ min: 0, max: 100 });
      const offset = faker.datatype.number({ min: 0, max: 100 });
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockRejectedValueOnce({
        status: 500,
      });

      await request(app.getHttpServer())
        .get(
          `/chains/${chainId}/safes/${safeAddress}/incoming-transfers/?cursor=limit%3D${limit}%26offset%3D${offset}`,
        )
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get).toBeCalledWith(
        `${safeConfigApiUrl}/api/v1/chains/${chainId}`,
        undefined,
      );
      expect(mockNetworkService.get).toBeCalledWith(
        `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/incoming-transfers/`,
        expect.objectContaining({
          params: expect.objectContaining({ offset, limit }),
        }),
      );
    });

    it('Failure: data validation fails', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockResolvedValueOnce({
        data: { results: ['invalidData'] },
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/incoming-transfers`)
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });

    it('Should get a ERC20 incoming transfer mapped to the expected format', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
        const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/incoming-transfers/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
        const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
        const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chain });
        }
        if (url === getIncomingTransfersUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'incoming-transfers/erc20/transfer-source-data.json',
            ),
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'incoming-transfers/erc20/safe-source-data.json',
            ),
          });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.reject({
            detail: 'Not found',
          });
        }
        if (url.includes(getTokenUrlPattern)) {
          return Promise.resolve({
            data: getJsonResource(
              'incoming-transfers/erc20/token-source-data.json',
            ),
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/incoming-transfers/`)
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual(
            getJsonResource('incoming-transfers/erc20/expected-response.json'),
          );
        });
    });

    it('Should get a ERC721 incoming transfer mapped to the expected format', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
        const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/incoming-transfers/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
        const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
        const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chain });
        }
        if (url === getIncomingTransfersUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'incoming-transfers/erc721/transfer-source-data.json',
            ),
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'incoming-transfers/erc721/safe-source-data.json',
            ),
          });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.reject({
            detail: 'Not found',
          });
        }
        if (url.includes(getTokenUrlPattern)) {
          return Promise.resolve({
            data: getJsonResource(
              'incoming-transfers/erc721/token-source-data.json',
            ),
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/incoming-transfers/`)
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual(
            getJsonResource('incoming-transfers/erc721/expected-response.json'),
          );
        });
    });

    it('Should get a native coin incoming transfer mapped to the expected format', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
        const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/incoming-transfers/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
        const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chain });
        }
        if (url === getIncomingTransfersUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'incoming-transfers/native-coin/transfer-source-data.json',
            ),
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'incoming-transfers/native-coin/safe-source-data.json',
            ),
          });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.reject({
            detail: 'Not found',
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/incoming-transfers/`)
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual(
            getJsonResource(
              'incoming-transfers/native-coin/expected-response.json',
            ),
          );
        });
    });
  });

  describe('GET queued transactions by Safe', () => {
    it('should get a transactions queue with labels and conflict headers', async () => {
      const chainId = faker.random.numeric();
      const chainResponse = chainBuilder().build();
      const safeAddress = faker.finance.ethereumAddress();
      const safeResponse = safeBuilder()
        .with('address', safeAddress)
        .with('nonce', 1)
        .build();
      const contractResponse = contractBuilder().build();
      const transactions: MultisigTransaction[] = [
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('isExecuted', false)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('nonce', 1)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('isExecuted', false)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('nonce', 1)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('nonce', 2)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('isExecuted', false)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('nonce', 2)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('isExecuted', false)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('nonce', 3)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('isExecuted', false)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('nonce', 4)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('isExecuted', false)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
      ];

      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
        const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
        const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
        const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chainResponse });
        }
        if (url === getMultisigTransactionsUrl) {
          return Promise.resolve({
            data: {
              count: 6,
              next: null,
              previous: null,
              results: transactions,
            },
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({ data: safeResponse });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.resolve({ data: contractResponse });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/transactions/queued`)
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
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().build();
      const contractResponse = contractBuilder().build();
      const safeResponse = safeBuilder()
        .with('address', safeAddress)
        .with('nonce', 1)
        .build();
      const transactions: MultisigTransaction[] = [
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('isExecuted', false)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('nonce', 1)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('isExecuted', false)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('nonce', 1)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('isExecuted', false)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('nonce', 1)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('isExecuted', false)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('nonce', 1)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('nonce', 2)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('isExecuted', false)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('nonce', 2)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('isExecuted', false)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('nonce', 3)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('isExecuted', false)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
        multiSignToJson(
          multisigTransactionBuilder()
            .with('safe', safeAddress)
            .with('nonce', 3)
            .with('safeTxHash', faker.finance.ethereumAddress())
            .with('isExecuted', false)
            .with('dataDecoded', null)
            .build(),
        ) as MultisigTransaction,
      ];
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
        const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
        const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
        const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chainResponse });
        }
        if (url === getMultisigTransactionsUrl) {
          return Promise.resolve({
            data: {
              count: 8,
              next: `${faker.internet.url()}/?limit=10&offset=50`,
              previous: `${faker.internet.url()}/?limit=10&offset=30`,
              results: transactions,
            },
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({ data: safeResponse });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.resolve({ data: contractResponse });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/chains/${chainId}/safes/${safeAddress}/transactions/queued/?cursor=limit%3D10%26offset%3D2`,
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
  });
});

const getJsonResource = (relativePath: string) => {
  const basePath = 'src/routes/transactions/__tests__/resources';
  return JSON.parse(readFileSync(`${basePath}/${relativePath}`, 'utf8'));
};
