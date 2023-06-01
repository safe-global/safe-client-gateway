import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../app.provider';
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
import { TestLoggingModule } from '../../logging/__tests__/test.logging.module';
import { ContractsModule } from './contracts.module';
import { ConfigurationModule } from '../../config/configuration.module';
import configuration from '../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../config/configuration.service.interface';

describe('Contracts controller', () => {
  let app: INestApplication;
  let safeConfigUrl;

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

  describe('GET contract data for an address', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/contracts/${contract.address}`:
            return Promise.resolve({ data: contract });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(200)
        .expect(contract);
    });

    it('Failure: Config API fails', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.reject(new Error());
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(503);
    });

    it('Failure: Transaction API fails', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/contracts/${contract.address}`:
            return Promise.reject(new Error());
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(503);
    });

    it('should get a validation error', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/contracts/${contract.address}`:
            return Promise.resolve({ data: { ...contract, name: false } });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });
  });
});
