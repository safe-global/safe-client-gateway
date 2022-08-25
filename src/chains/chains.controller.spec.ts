import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import chainFactory from '../datasources/config-api/entities/__tests__/chain.factory';
import { ChainsModule } from './chains.module';
import { Backbone, Chain, Page } from './entities';
import backboneFactory from './entities/__tests__/backbone.factory';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../common/network/__tests__/test.network.module';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../common/config/__tests__/test.configuration.module';

describe('Chains Controller (Unit)', () => {
  let app: INestApplication;

  const chainsResponse: Page<Chain> = {
    count: 2,
    next: null,
    previous: null,
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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        ChainsModule,
        // common
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
          ...chainsResponse,
          results: chainsResponse.results.map((result) => ({
            chainId: result.chainId,
            chainName: result.chainName,
            vpcTransactionService: result.vpcTransactionService,
          })),
        });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        expect.stringContaining('/api/v1/chains'),
      );
    });

    it('Failure', async () => {
      mockNetworkService.get.mockRejectedValueOnce({
        status: 500,
      });

      await request(app.getHttpServer()).get('/chains').expect(503).expect({
        message: 'Service unavailable',
        code: 503,
      });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        expect.stringContaining('/api/v1/chains'),
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
      expect(mockNetworkService.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/api/v1/chains/1'),
      );
      expect(mockNetworkService.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/api/v1/about'),
      );
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
        expect.stringContaining('/api/v1/chains/1'),
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
      expect(mockNetworkService.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/api/v1/chains/1'),
      );
      expect(mockNetworkService.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/api/v1/about'),
      );
    });
  });
});
