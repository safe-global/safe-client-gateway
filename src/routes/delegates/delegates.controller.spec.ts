import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import delegateFactory from '../../domain/delegate/entities/__tests__/delegate.factory';
import { DelegatesModule } from './delegates.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import chainFactory from '../../domain/chains/entities/__tests__/chain.factory';
import { Delegate } from './entities/delegate.entity';
import { Page } from '../../domain/entities/page.entity';
import { DomainModule } from '../../domain.module';
import { DataSourceErrorFilter } from '../common/filters/data-source-error.filter';
import { faker } from '@faker-js/faker';

describe('Delegates controller', () => {
  let app: INestApplication;

  beforeAll(async () => {
    fakeConfigurationService.set(
      'safeConfig.baseUri',
      'https://test.safe.config',
    );

    fakeConfigurationService.set(
      'exchange.baseUri',
      'https://test.exchange.service',
    );

    fakeConfigurationService.set('exchange.apiKey', 'https://test.api.key');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        DelegatesModule,
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

  describe('GET delegates for a Safe', () => {
    it('Success', async () => {
      const safe = faker.finance.ethereumAddress();
      const chainId = '1';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      const pageDelegates = <Page<Delegate>>{
        count: 2,
        results: [delegateFactory(safe), delegateFactory(safe)],
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: pageDelegates });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(pageDelegates);
    });

    it('Should return empty result', async () => {
      const safe = faker.finance.ethereumAddress();
      const chainId = '1';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      const pageDelegates = <Page<Delegate>>{
        count: 0,
        results: [],
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: pageDelegates });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(pageDelegates);
    });

    it('Should fail with bad request', async () => {
      const chainId = '1';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/delegates`)
        .expect(400)
        .expect({
          message: 'At least one query param must be provided',
          statusCode: 400,
        });
    });
  });
});
