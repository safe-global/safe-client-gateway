import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../app.provider';
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
import { ValidationModule } from '../../validation/validation.module';
import { ContractsModule } from './contracts.module';

describe('Contracts controller', () => {
  let app: INestApplication;

  const safeConfigUrl = faker.internet.url();

  beforeAll(async () => {
    fakeConfigurationService.set('safeConfig.baseUri', safeConfigUrl);
    fakeConfigurationService.set('exchange.baseUri', faker.internet.url());
    fakeConfigurationService.set(
      'exchange.apiKey',
      faker.random.alphaNumeric(),
    );
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        ContractsModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  describe('GET contract data for an address', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      mockNetworkService.get.mockImplementation((url) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contract.address}`
        ) {
          return Promise.resolve({ data: contract });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(200)
        .expect(contract);
    });

    it('Should make just one network call to tx-service when a not found contract is required several times', async () => {
      const chain = chainBuilder().build();
      const { address } = contractBuilder().build();
      mockNetworkService.get.mockImplementation((url) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain });
        }
        if (url === `${chain.transactionService}/api/v1/contracts/${address}`) {
          return Promise.reject({ status: 404 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${address}`)
        .expect(404)
        .expect({
          message: 'An error occurred',
          code: 404,
        });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${address}`)
        .expect(404)
        .expect({
          message: 'An error occurred',
          code: 404,
        });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${address}`)
        .expect(404)
        .expect({
          message: 'An error occurred',
          code: 404,
        });

      // expected one call to config service, and just one call to transaction service
      expect(mockNetworkService.get.mock.calls.length).toBe(2);
    });
  });
});
