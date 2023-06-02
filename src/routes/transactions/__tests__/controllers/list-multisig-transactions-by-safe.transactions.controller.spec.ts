import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { readFileSync } from 'fs';
import * as request from 'supertest';
import { TestAppProvider } from '../../../../app.provider';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../../../domain.module';
import { chainBuilder } from '../../../../domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '../../../../domain/contracts/entities/__tests__/contract.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '../../../../domain/data-decoder/entities/__tests__/data-decoded.builder';
import { safeAppBuilder } from '../../../../domain/safe-apps/entities/__tests__/safe-app.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '../../../../logging/__tests__/test.logging.module';
import { ValidationModule } from '../../../../validation/validation.module';
import { TransactionsModule } from '../../transactions.module';
import { ConfigurationModule } from '../../../../config/configuration.module';
import configuration from '../../../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../../../config/configuration.service.interface';

describe('List multisig transactions by Safe - Transactions Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;

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
        ConfigurationModule.register(configuration),
        TestLoggingModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Failure: Config API fails', async () => {
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    mockNetworkService.get.mockRejectedValueOnce({
      status: 500,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(mockNetworkService.get).toBeCalledTimes(1);
    expect(mockNetworkService.get).toBeCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
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
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(mockNetworkService.get).toBeCalledTimes(2);
    expect(mockNetworkService.get).toBeCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
    expect(mockNetworkService.get).toBeCalledWith(
      `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`,
      expect.objectContaining({
        params: expect.objectContaining({
          ordering: '-nonce',
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
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
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
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`;
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
      if (url === getTokenUrlPattern) {
        return Promise.resolve({
          data: getJsonResource(
            'multisig-transactions/erc20/token-source-data.json',
          ),
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(
          getJsonResource('multisig-transactions/erc20/expected-response.json'),
        );
      });
  });

  it('Should get a ERC721 transfer mapped to the expected format', async () => {
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chainResponse.transactionService}/api/v1/tokens/0x7Af3460d552f832fD7E2DE973c628ACeA59B0712`;
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
      if (url === getTokenUrlPattern) {
        return Promise.resolve({
          data: getJsonResource(
            'multisig-transactions/erc721/token-source-data.json',
          ),
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
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
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
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
        `/v1/chains/${chainId}/safes/${domainTransaction.safe}/multisig-transactions`,
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
                  logoUri: safeAppsResponse[0].iconUrl,
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

const getJsonResource = (relativePath: string) => {
  const basePath = 'src/routes/transactions/__tests__/resources';
  return JSON.parse(readFileSync(`${basePath}/${relativePath}`, 'utf8'));
};
