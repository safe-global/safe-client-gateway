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
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '../../domain/data-decoder/entities/__tests__/data-decoded.builder';
import { safeAppBuilder } from '../../domain/safe-apps/entities/__tests__/safe-app.builder';
import {
  moduleTransactionBuilder,
  toJson,
} from '../../domain/safe/entities/__tests__/module-transaction.builder';
import { confirmationBuilder } from '../../domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import {
  multisigTransactionBuilder,
  toJson as multiSignToJson,
  toJson as multisigTransactionToJson,
} from '../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../domain/safe/entities/__tests__/safe.builder';
import { NULL_ADDRESS } from '../common/constants';
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
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const safeAddress = '0x710085cB90e4Ce09F80E354Cf579a32C9790A140';
      const confirmedAddress = '0xf10E2042ec19747401E5EA174EfB63A0058265E6';
      const nonConfirmedAddress = '0x76EA7f829669d7394f42b035e095B7880B45B421';
      const safeResponse = safeBuilder()
        .with('address', safeAddress)
        .with('nonce', 1)
        .with('threshold', 2)
        .with('owners', [nonConfirmedAddress, confirmedAddress])
        .build();
      const contractAddress = '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D';
      const contractResponse = contractBuilder()
        .with('address', contractAddress)
        .with('displayName', 'Gnosis Safe: MultiSendCallOnly')
        .with(
          'logoUri',
          `https://safe-transaction-assets.staging.5afe.dev/contracts/logos/${contractAddress}.png`,
        )
        .build();
      const confirmations = [
        confirmationBuilder().with('owner', confirmedAddress).build(),
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
              results: [
                multiSignToJson(
                  multisigTransactionBuilder()
                    .with('safe', safeAddress)
                    .with('isExecuted', false)
                    .with(
                      'safeTxHash',
                      '0xba5932e36e163c4bedce954b7a3feeac842f5466807754b357fa1e5b23f7a0dc',
                    )
                    .with('confirmationsRequired', 2)
                    .with('confirmations', confirmations)
                    .with('data', faker.datatype.hexadecimal(32))
                    .with('nonce', 1)
                    .with(
                      'submissionDate',
                      new Date('2022-12-07T10:47:02.362565Z'),
                    )
                    .with('executionDate', null)
                    .with('dataDecoded', {
                      method: 'changeThreshold',
                      parameters: [
                        {
                          name: '_threshold',
                          type: 'uint256',
                          value: '1',
                        },
                      ],
                    })
                    .with('value', '0')
                    .with('gasPrice', '0')
                    .with('gasToken', NULL_ADDRESS)
                    .with('refundReceiver', NULL_ADDRESS)
                    .with('baseGas', 0)
                    .with('safeTxGas', 0)
                    .with('operation', 0)
                    .with('to', safeAddress)
                    .build(),
                ),
                multiSignToJson(
                  multisigTransactionBuilder()
                    .with('safe', safeAddress)
                    .with('isExecuted', false)
                    .with(
                      'safeTxHash',
                      '0x5c88e796125f695d26e9b611db2344052c1e006fc44798cb633bdbf064301e4e',
                    )
                    .with('confirmationsRequired', 2)
                    .with('confirmations', confirmations)
                    .with('data', null)
                    .with('nonce', 1)
                    .with('executionDate', null)
                    .with(
                      'submissionDate',
                      new Date('2022-12-07T10:59:37.705384Z'),
                    )
                    .with('dataDecoded', JSON.parse(faker.datatype.json()))
                    .with('value', '0')
                    .with('gasPrice', '0')
                    .with('gasToken', NULL_ADDRESS)
                    .with('refundReceiver', NULL_ADDRESS)
                    .with('baseGas', 0)
                    .with('safeTxGas', 0)
                    .with('operation', 0)
                    .with('to', safeAddress)
                    .build(),
                ),
                multiSignToJson(
                  multisigTransactionBuilder()
                    .with('safe', safeAddress)
                    .with('to', safeAddress)
                    .with('value', '0')
                    .with('data', null)
                    .with('operation', 0)
                    .with('gasToken', NULL_ADDRESS)
                    .with('safeTxGas', 0)
                    .with('baseGas', 0)
                    .with('gasPrice', '0')
                    .with('refundReceiver', NULL_ADDRESS)
                    .with('nonce', 2)
                    .with('executionDate', null)
                    .with(
                      'submissionDate',
                      new Date('2022-12-07T10:59:29.112703Z'),
                    )
                    .with(
                      'safeTxHash',
                      '0xd471fd6216ffe4111ed6581d724ca578255991360a9343de118f273e8a0165b3',
                    )
                    .with('isExecuted', false)
                    .with('dataDecoded', JSON.parse(faker.datatype.json()))
                    .with('confirmationsRequired', 2)
                    .with('confirmations', confirmations)
                    .build(),
                ),
                multiSignToJson(
                  multisigTransactionBuilder()
                    .with('safe', safeAddress)
                    .with('to', safeAddress)
                    .with('value', '0')
                    .with('data', faker.datatype.hexadecimal(32))
                    .with('operation', 0)
                    .with('gasToken', NULL_ADDRESS)
                    .with('safeTxGas', 0)
                    .with('baseGas', 0)
                    .with('gasPrice', '0')
                    .with('refundReceiver', NULL_ADDRESS)
                    .with('nonce', 2)
                    .with('executionDate', null)
                    .with(
                      'submissionDate',
                      new Date('2022-12-07T10:49:07.810694Z'),
                    )
                    .with(
                      'safeTxHash',
                      '0xf3a32cf14a89d5705cc6b85172e004fcf6e1b08b42e216e6db609719c9b2e1b9',
                    )
                    .with('isExecuted', false)
                    .with('dataDecoded', {
                      method: 'changeThreshold',
                      parameters: [
                        {
                          name: '_threshold',
                          type: 'uint256',
                          value: '1',
                        },
                      ],
                    })
                    .with('confirmationsRequired', 2)
                    .with('confirmations', confirmations)
                    .build(),
                ),
                multiSignToJson(
                  multisigTransactionBuilder()
                    .with('safe', safeAddress)
                    .with('to', faker.finance.ethereumAddress())
                    .with('value', '0')
                    .with('data', faker.datatype.hexadecimal(32))
                    .with('operation', 1)
                    .with('gasToken', NULL_ADDRESS)
                    .with('safeTxGas', 0)
                    .with('baseGas', 0)
                    .with('gasPrice', '0')
                    .with('refundReceiver', NULL_ADDRESS)
                    .with('nonce', 3)
                    .with('executionDate', null)
                    .with(
                      'submissionDate',
                      new Date('2022-12-07T11:00:23.340697Z'),
                    )
                    .with(
                      'safeTxHash',
                      '0x8d0b19aada27d0635eaa989b13c42daecc6696578cc5580e321873a1168cef4f',
                    )
                    .with('isExecuted', false)
                    .with('dataDecoded', {
                      method: 'multiSend',
                      parameters: [
                        {
                          name: 'transactions',
                          type: 'bytes',
                          value: faker.datatype.hexadecimal(32),
                          valueDecoded: [{}, {}, {}],
                        },
                      ],
                    })
                    .with('confirmationsRequired', 2)
                    .with('confirmations', confirmations)
                    .build(),
                ),
                multiSignToJson(
                  multisigTransactionBuilder()
                    .with('safe', safeAddress)
                    .with('to', confirmedAddress)
                    .with('value', '10000000000000000')
                    .with('data', null)
                    .with('operation', 0)
                    .with('gasToken', NULL_ADDRESS)
                    .with('safeTxGas', 0)
                    .with('baseGas', 0)
                    .with('gasPrice', '0')
                    .with('refundReceiver', NULL_ADDRESS)
                    .with('nonce', 4)
                    .with('executionDate', null)
                    .with(
                      'submissionDate',
                      new Date('2022-12-22T16:36:31.685246Z'),
                    )
                    .with(
                      'safeTxHash',
                      '0x086d86a1e5e7e301b45c71e9ee23c91eb005ad09c924eaba62e36486c74c0a86',
                    )
                    .with('isExecuted', false)
                    .with('dataDecoded', null)
                    .with('confirmationsRequired', 2)
                    .with('confirmations', confirmations)
                    .build(),
                ),
              ],
            },
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: safeResponse,
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
        .get(`/chains/${chainId}/safes/${safeAddress}/transactions/queued`)
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual(
            getJsonResource('queued-items/single-page/expected-response.json'),
          );
        });
    });

    it('should get a transactions queue with labels and conflict headers for a multi-page queue', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
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
            data: getJsonResource(
              'queued-items/multi-page/transactions-source-data.json',
            ),
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: getJsonResource(
              'queued-items/multi-page/safe-source-data.json',
            ),
          });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.resolve({
            data: getJsonResource(
              'queued-items/multi-page/contract-source-data.json',
            ),
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/chains/${chainId}/safes/${safeAddress}/transactions/queued/?cursor=limit%3D10%26offset%3D2`,
        )
        .expect(200)
        .then(({ body }) => {
          const expectedResponse = getJsonResource(
            'queued-items/multi-page/expected-response.json',
          );
          expect(body).toEqual(
            expect.objectContaining({
              ...expectedResponse,
              next: expect.stringContaining('?cursor='),
              previous: expect.stringContaining('?cursor='),
            }),
          );
        });
    });
  });
});

const getJsonResource = (relativePath: string) => {
  const basePath = 'src/routes/transactions/__tests__/resources';
  return JSON.parse(readFileSync(`${basePath}/${relativePath}`, 'utf8'));
};
