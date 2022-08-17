import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import * as request from 'supertest';
import chainFactory from '../services/config-service/entities/__tests__/chain.factory';
import { ChainsModule } from './chains.module';
import { Backbone, Chain, Page } from './entities';
import backboneFactory from './entities/__tests__/backbone.factory';

jest.mock('axios');
const axiosMock = axios as jest.Mocked<typeof axios>;

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ChainsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('GET /chains', () => {
    it('Success', async () => {
      axiosMock.get.mockResolvedValueOnce({ data: chainsResponse });

      await request(app.getHttpServer())
        .get('/chains')
        .expect(HttpStatus.OK)
        .expect({
          ...chainsResponse,
          results: chainsResponse.results.map((result) => ({
            chainId: result.chainId,
            chainName: result.chainName,
            vpcTransactionService: result.vpcTransactionService,
          })),
        });

      expect(axiosMock.get).toBeCalledTimes(1);
      expect(axiosMock.get).toBeCalledWith(
        expect.stringContaining('/api/v1/chains'),
      );
    });

    it('Failure', async () => {
      axiosMock.get.mockRejectedValueOnce({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });

      await request(app.getHttpServer())
        .get('/chains')
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
        .expect({
          message: 'Service unavailable',
          code: HttpStatus.SERVICE_UNAVAILABLE,
        });

      expect(axiosMock.get).toBeCalledTimes(1);
      expect(axiosMock.get).toBeCalledWith(
        expect.stringContaining('/api/v1/chains'),
      );
    });
  });

  describe('GET /:chainId/about/backbone', () => {
    it('Success', async () => {
      axiosMock.get.mockResolvedValueOnce({ data: chainResponse });
      axiosMock.get.mockResolvedValueOnce({ data: backboneResponse });

      await request(app.getHttpServer())
        .get('/chains/1/about/backbone')
        .expect(HttpStatus.OK)
        .expect(backboneResponse);

      expect(axiosMock.get).toBeCalledTimes(2);
      expect(axiosMock.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/api/v1/chains/1'),
      );
      expect(axiosMock.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/api/v1/about'),
      );
    });

    it('Failure getting the chain', async () => {
      axiosMock.get.mockRejectedValueOnce({ status: HttpStatus.BAD_REQUEST });

      await request(app.getHttpServer())
        .get('/chains/1/about/backbone')
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
        .expect({
          message: 'Service unavailable',
          code: HttpStatus.SERVICE_UNAVAILABLE,
        });

      expect(axiosMock.get).toBeCalledTimes(1);
      expect(axiosMock.get).toBeCalledWith(
        expect.stringContaining('/api/v1/chains/1'),
      );
    });

    it('Failure getting the backbone data', async () => {
      axiosMock.get.mockResolvedValueOnce({ data: chainResponse });
      axiosMock.get.mockRejectedValueOnce({ status: HttpStatus.BAD_GATEWAY });

      await request(app.getHttpServer())
        .get('/chains/1/about/backbone')
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
        .expect({
          message: 'Service unavailable',
          code: HttpStatus.SERVICE_UNAVAILABLE,
        });

      expect(axiosMock.get).toBeCalledTimes(2);
      expect(axiosMock.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/api/v1/chains/1'),
      );
      expect(axiosMock.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/api/v1/about'),
      );
    });
  });
});
