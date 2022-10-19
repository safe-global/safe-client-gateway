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
      const safe = '0x5afe3855358e112b5647b952709e6165e1c1eeee';
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

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get.mock.calls[0][0]).toBe(
        'https://test.safe.config/api/v1/chains/1',
      );
      expect(mockNetworkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/delegates/`,
      );
      expect(mockNetworkService.get.mock.calls[1][1]).toStrictEqual({
        params: {
          safe: safe,
          delegate: undefined,
          delegator: undefined,
          label: undefined,
          limit: undefined,
          offset: undefined,
        },
      });
    });

    it('Should return empty result', async () => {
      const safe = '0x5afe3855358e112b5647b952709e6165e1c1eeee';
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

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get.mock.calls[0][0]).toBe(
        'https://test.safe.config/api/v1/chains/1',
      );
      expect(mockNetworkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/delegates/`,
      );
      expect(mockNetworkService.get.mock.calls[1][1]).toStrictEqual({
        params: {
          safe: safe,
          delegate: undefined,
          delegator: undefined,
          label: undefined,
          limit: undefined,
          offset: undefined,
        },
      });
    });

    it('Should failure with bad request', async () => {
      const chainId = '1';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockRejectedValueOnce({ status: 400 });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/delegates`)
        .expect(503)
        .expect({
          message: 'Service unavailable',
          code: 503,
        });

      expect(mockNetworkService.get).toBeCalledTimes(2);
    });
  });
});
