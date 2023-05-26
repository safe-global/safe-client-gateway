import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { readFileSync } from 'fs';
import * as request from 'supertest';
import { TestAppProvider } from '../../../../app.provider';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../../../config/__tests__/test.configuration.module';
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
import { TestLoggingModule } from '../../../../logging/__tests__/test.logging.module';
import { ValidationModule } from '../../../../validation/validation.module';
import { TransactionsModule } from '../../transactions.module';

describe('List incoming transfers by Safe - Transactions Controller (Unit)', () => {
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
        TestLoggingModule,
        TestNetworkModule,
        ValidationModule,
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
    mockNetworkService.get.mockRejectedValueOnce({
      status: 500,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers`)
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
        `/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers/?cursor=limit%3D${limit}%26offset%3D${offset}`,
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
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers`)
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
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/0xdc31Ee1784292379Fbb2964b3B9C4124D8F89C60`;
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
      if (url === getTokenUrlPattern) {
        return Promise.resolve({
          data: getJsonResource(
            'incoming-transfers/erc20/token-source-data.json',
          ),
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers/`)
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
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85`;
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
      if (url === getTokenUrlPattern) {
        return Promise.resolve({
          data: getJsonResource(
            'incoming-transfers/erc721/token-source-data.json',
          ),
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers/`)
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
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers/`)
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

const getJsonResource = (relativePath: string) => {
  const basePath = 'src/routes/transactions/__tests__/resources';
  return JSON.parse(readFileSync(`${basePath}/${relativePath}`, 'utf8'));
};
