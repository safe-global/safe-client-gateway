import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { TestBlockchainApiManagerModule } from '@/modules/blockchain/datasources/__tests__/test.blockchain-api.manager';

describe('Chains V2 Controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let serviceKey: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  const chainsResponse: Page<Chain> = {
    count: 2,
    next: null,
    previous: null,
    results: [chainBuilder().build(), chainBuilder().build()],
  };

  const chainResponse: Chain = chainBuilder().build();

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule({
      modules: [
        {
          originalModule: BlockchainModule,
          testModule: TestBlockchainApiManagerModule,
        },
      ],
    });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    serviceKey = configurationService.getOrThrow('safeConfig.serviceKey');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v2/chains', () => {
    it('should return paginated chains from Config Service v2', async () => {
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainsResponse),
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v2/chains')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('count');
          expect(res.body).toHaveProperty('results');
          expect(Array.isArray(res.body.results)).toBe(true);
          expect(res.body.results.length).toBe(2);
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${safeConfigUrl}/api/v2/chains/${serviceKey}`,
        }),
      );
    });

    it('should handle pagination parameters', async () => {
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainsResponse),
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v2/chains?cursor=limit%3D10%26offset%3D20')
        .expect(200);

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${safeConfigUrl}/api/v2/chains/${serviceKey}`,
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              limit: 10,
              offset: 20,
            }),
          }),
        }),
      );
    });

    it('should handle Config Service v2 errors', async () => {
      networkService.get.mockRejectedValueOnce(
        new Error('Config Service unavailable'),
      );

      await request(app.getHttpServer()).get('/v2/chains').expect(503);
    });
  });

  describe('GET /v2/chains/:chainId', () => {
    it('should return single chain from Config Service v2', async () => {
      const chainId = '1';
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chainId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('chainId');
          expect(res.body.chainId).toBe(chainResponse.chainId);
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${safeConfigUrl}/api/v2/chains/${serviceKey}/${chainId}`,
        }),
      );
    });

    it('should return 404 for non-existent chain', async () => {
      const chainId = '999';
      const error = new NetworkResponseError(
        new URL(`${safeConfigUrl}/api/v2/chains/${serviceKey}/${chainId}`),
        {
          status: 404,
        } as Response,
        { message: 'Not Found' },
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v2/chains/${chainId}`)
        .expect(404);
    });
  });

  describe('Service key configuration', () => {
    it('should use configured service key in Config Service v2 calls', async () => {
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainsResponse),
        status: 200,
      });

      await request(app.getHttpServer()).get('/v2/chains').expect(200);

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(`/api/v2/chains/${serviceKey}`),
        }),
      );
    });

    it('should use service key for both list and single chain endpoints', async () => {
      const chainId = '1';
      networkService.get
        .mockResolvedValueOnce({
          data: rawify(chainsResponse),
          status: 200,
        })
        .mockResolvedValueOnce({
          data: rawify(chainResponse),
          status: 200,
        });

      await request(app.getHttpServer()).get('/v2/chains').expect(200);
      await request(app.getHttpServer())
        .get(`/v2/chains/${chainId}`)
        .expect(200);

      expect(networkService.get).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          url: `${safeConfigUrl}/api/v2/chains/${serviceKey}`,
        }),
      );
      expect(networkService.get).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          url: `${safeConfigUrl}/api/v2/chains/${serviceKey}/${chainId}`,
        }),
      );
    });
  });
});
