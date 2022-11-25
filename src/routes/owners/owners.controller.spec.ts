import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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
import { DataSourceErrorFilter } from '../common/filters/data-source-error.filter';
import { OwnersModule } from './owners.module';

describe('Owners Controller (Unit)', () => {
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
        OwnersModule,
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

  describe('GET safes by owner address', () => {
    it(`Success`, async () => {
      const chainId = faker.random.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      const chainResponse = chainFactory(chainId);
      const transactionApiSafeListResponse = {
        safes: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockResolvedValueOnce({
        data: transactionApiSafeListResponse,
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect(transactionApiSafeListResponse);
    });

    it('Failure: Config API fails', async () => {
      const chainId = faker.random.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      mockNetworkService.get.mockRejectedValueOnce({
        status: 500,
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/owners/${ownerAddress}/safes`)
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
      const ownerAddress = faker.finance.ethereumAddress();
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockRejectedValueOnce({
        status: 500,
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/owners/${ownerAddress}/safes`)
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
        `${chainResponse.transactionService}/api/v1/owners/${ownerAddress}/safes/`,
        undefined,
      );
    });

    it('Failure: data validation fails', async () => {
      const chainId = faker.random.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      const chainResponse = chainFactory(chainId);
      const transactionApiSafeListResponse = {
        safes: [
          faker.finance.ethereumAddress(),
          faker.datatype.number(),
          faker.finance.ethereumAddress(),
        ],
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockResolvedValueOnce({
        data: transactionApiSafeListResponse,
      });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/owners/${ownerAddress}/safes`)
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });
  });
});
