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
import chainFactory from '../../domain/chains/entities/__tests__/chain.factory';
import contractFactory from '../../domain/contracts/entities/__tests__/contract.factory';
import safeFactory from '../../domain/safe/entities/__tests__/safe.factory';
import { Token, TokenType } from '../../domain/tokens/entities/token.entity';
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
      const chainResponse = chainFactory(chainId);
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
      const chainResponse = chainFactory(chainId);
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
      const chainResponse = chainFactory(chainId);
      const transactionApiSafeResponse = getJsonResource(
        'erc20/erc20-safe-source-data.json',
      );
      const transactionApiMultisigTransactionsResponse = getJsonResource(
        'erc20/erc20-transfer-source-data.json',
      );
      const expected = getJsonResource(
        'erc20/erc20-transfer-expected-response.json',
      );
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
            data: transactionApiMultisigTransactionsResponse,
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: transactionApiSafeResponse,
          });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.reject({
            detail: 'Not found',
          });
        }
        if (url.includes(getTokenUrlPattern)) {
          return Promise.resolve({
            data: <Token>{
              address: transactionApiMultisigTransactionsResponse.results[0].to,
              decimals: 6,
              logoUri:
                'https://safe-transaction-assets.staging.5afe.dev/tokens/logos/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48.png',
              name: 'USD Coin',
              symbol: 'USDC',
              type: TokenType.Erc20,
            },
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual(expected);
        });
    });

    it('Should get a ERC721 transfer mapped to the expected format', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainFactory(chainId);
      const transactionApiSafeResponse = getJsonResource(
        'erc721/erc721-safe-source-data.json',
      );
      const transactionApiTokenResponse = getJsonResource(
        'erc721/erc721-token-source-data.json',
      );
      const transactionApiMultisigTransactionsResponse = getJsonResource(
        'erc721/erc721-transfer-source-data.json',
      );
      const expected = getJsonResource(
        'erc721/erc721-transfer-expected-response.json',
      );
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
            data: transactionApiMultisigTransactionsResponse,
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: transactionApiSafeResponse,
          });
        }
        if (url.includes(getContractUrlPattern)) {
          return Promise.reject({
            detail: 'Not found',
          });
        }
        if (url.includes(getTokenUrlPattern)) {
          return Promise.resolve({
            data: transactionApiTokenResponse,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual(expected);
        });
    });

    it.skip('Success', async () => {
      const chainId = faker.random.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainFactory(chainId);
      const transactionApiSafeResponse = safeFactory(safeAddress);
      const transactionApiContractResponse = contractFactory();
      const transactionApiMultisigTransactionsResponse = getJsonResource(
        'multisig-transactions-response.json',
      );
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
        const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
        const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
        const getContractPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
        if (url === getChainUrl) {
          return Promise.resolve({ data: chainResponse });
        }
        if (url === getMultisigTransactionsUrl) {
          return Promise.resolve({
            data: transactionApiMultisigTransactionsResponse,
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({
            data: transactionApiSafeResponse,
          });
        }
        if (url.includes(getContractPattern)) {
          return Promise.resolve({
            data: transactionApiContractResponse,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
        .expect(200)
        .then(({ body }) => {
          expect(body).toBeDefined();
        });
    });
  });
});

const getJsonResource = (relativePath: string) => {
  const basePath = 'src/routes/transactions/__tests__/resources';
  return JSON.parse(readFileSync(`${basePath}/${relativePath}`, 'utf8'));
};
