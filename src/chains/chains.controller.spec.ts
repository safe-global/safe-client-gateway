import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import chainFactory from '../datasources/config-api/entities/__tests__/chain.factory';
import { ChainsModule } from './chains.module';
import backboneFactory from './entities/__tests__/backbone.factory';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../common/network/__tests__/test.network.module';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../common/config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../common/cache/__tests__/test.cache.module';
import { Page } from '../common/entities/page.entity';
import { Chain } from '../datasources/config-api/entities/chain.entity';
import { Backbone } from '../datasources/transaction-api/entities/backbone.entity';

describe('Chains Controller (Unit)', () => {
  let app: INestApplication;

  const chainsResponse: Page<Chain> = {
    count: 2,
    next: undefined,
    previous: undefined,
    results: [chainFactory(), chainFactory()],
  };

  const chainResponse: Chain = chainFactory();
  const backboneResponse: Backbone = backboneFactory();

  beforeAll(async () => {
    fakeConfigurationService.set(
      'safeConfig.baseUri',
      'https://test.safe.config',
    );
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        ChainsModule,
        // common
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('GET /chains', () => {
    it('Success', async () => {
      mockNetworkService.get.mockResolvedValueOnce({ data: chainsResponse });

      await request(app.getHttpServer())
        .get('/chains')
        .expect(200)
        .expect({
          count: chainsResponse.count,
          results: chainsResponse.results.map((result) => ({
            chainId: result.chainId,
            chainName: result.chainName,
            vpcTransactionService: result.vpcTransactionService,
          })),
        });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        'https://test.safe.config/api/v1/chains',
        { params: { limit: undefined, offset: undefined } },
      );
    });

    it('Failure: network service fails', async () => {
      mockNetworkService.get.mockRejectedValueOnce({
        status: 500,
      });

      await request(app.getHttpServer()).get('/chains').expect(503).expect({
        message: 'Service unavailable',
        code: 503,
      });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        'https://test.safe.config/api/v1/chains',
        { params: { limit: undefined, offset: undefined } },
      );
    });

    it('Failure: received data is not valid', async () => {
      mockNetworkService.get.mockResolvedValueOnce({
        data: {
          ...chainsResponse,
          results: [...chainsResponse.results, { invalid: 'item' }],
        },
      });

      await request(app.getHttpServer()).get('/chains').expect(500).expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        'https://test.safe.config/api/v1/chains',
        { params: { limit: undefined, offset: undefined } },
      );
    });
  });

  describe('GET /:chainId/about/backbone', () => {
    it('Success', async () => {
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockResolvedValueOnce({ data: backboneResponse });

      await request(app.getHttpServer())
        .get('/chains/1/about/backbone')
        .expect(200)
        .expect(backboneResponse);

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get.mock.calls[0][0]).toBe(
        'https://test.safe.config/api/v1/chains/1',
      );
      expect(mockNetworkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/about`,
      );
      expect(mockNetworkService.get.mock.calls[1][1]).toBe(undefined);
    });

    it('Failure getting the chain', async () => {
      mockNetworkService.get.mockRejectedValueOnce({
        status: 400,
      });

      await request(app.getHttpServer())
        .get('/chains/1/about/backbone')
        .expect(503)
        .expect({
          message: 'Service unavailable',
          code: 503,
        });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        'https://test.safe.config/api/v1/chains/1',
        undefined,
      );
    });

    it('Failure getting the backbone data', async () => {
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockRejectedValueOnce({
        status: 502,
      });

      await request(app.getHttpServer())
        .get('/chains/1/about/backbone')
        .expect(503)
        .expect({
          message: 'Service unavailable',
          code: 503,
        });

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get.mock.calls[0][0]).toBe(
        'https://test.safe.config/api/v1/chains/1',
      );
      expect(mockNetworkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/about`,
      );
      expect(mockNetworkService.get.mock.calls[1][1]).toBe(undefined);
    });
  });
});
