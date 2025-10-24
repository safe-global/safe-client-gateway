import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestPortfolioApiModule } from '@/datasources/portfolio-api/__tests__/test.portfolio-api.module';
import { PortfolioApiModule } from '@/datasources/portfolio-api/portfolio-api.module';
import {
  ZERION_PORTFOLIO_API,
  ZAPPER_PORTFOLIO_API,
} from '@/datasources/portfolio-api/portfolio-api.module';
import type { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { tokenBalanceBuilder } from '@/domain/portfolio/entities/__tests__/token-balance.builder';
import { tokenInfoBuilder } from '@/domain/portfolio/entities/__tests__/token-info.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import request from 'supertest';
import { getAddress } from 'viem';

describe('PortfolioController', () => {
  let app: INestApplication<Server>;
  let zerionPortfolioApi: jest.MockedObjectDeep<IPortfolioApi>;
  let zapperPortfolioApi: jest.MockedObjectDeep<IPortfolioApi>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      portfolio: {
        cache: {
          positions: {
            ttlSeconds: 30,
          },
          pnl: {
            ttlSeconds: 60,
          },
        },
        filters: {
          dustThresholdUsd: 1.0,
        },
        providers: {
          zerion: {
            apiKey: faker.string.hexadecimal({ length: 32 }),
            baseUri: faker.internet.url({ appendSlash: false }),
            currencies: ['usd', 'eur', 'gbp'],
          },
          zapper: {
            apiKey: faker.string.hexadecimal({ length: 32 }),
            baseUri: faker.internet.url({ appendSlash: false }),
          },
        },
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      modules: [
        {
          originalModule: PortfolioApiModule,
          testModule: TestPortfolioApiModule,
        },
      ],
    });

    zerionPortfolioApi = moduleFixture.get(ZERION_PORTFOLIO_API);
    zapperPortfolioApi = moduleFixture.get(ZAPPER_PORTFOLIO_API);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/portfolio/:address', () => {
    const address = getAddress(faker.finance.ethereumAddress());

    it('should return portfolio for valid address', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      const response = await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalBalanceFiat');
      expect(response.body).toHaveProperty('totalTokenBalanceFiat');
      expect(response.body).toHaveProperty('totalPositionsBalanceFiat');
      expect(response.body).toHaveProperty('tokenBalances');
      expect(response.body).toHaveProperty('positionBalances');
    });

    it('should use Zerion provider by default', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .expect(200);

      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode: 'USD',
        trusted: true,
      });
    });

    it('should accept fiatCode query parameter', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?fiatCode=EUR`)
        .expect(200);

      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode: 'EUR',
        trusted: true,
      });
    });

    it('should accept chainIds query parameter', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?chainIds=1,10,137`)
        .expect(200);

      // ChainIds are used for filtering, not passed to API
      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalled();
    });

    it('should accept trusted query parameter', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?trusted=false`)
        .expect(200);

      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalled();
    });

    it('should accept excludeDust query parameter', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?excludeDust=false`)
        .expect(200);

      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalled();
    });

    it('should accept provider=zerion', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?provider=zerion`)
        .expect(200);

      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalled();
      expect(zapperPortfolioApi.getPortfolio).not.toHaveBeenCalled();
    });

    it('should accept provider=zapper', async () => {
      const portfolio = portfolioBuilder().build();
      zapperPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?provider=zapper`)
        .expect(200);

      expect(zapperPortfolioApi.getPortfolio).toHaveBeenCalled();
      expect(zerionPortfolioApi.getPortfolio).not.toHaveBeenCalled();
    });

    it('should accept case-insensitive provider names', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?provider=ZERION`)
        .expect(200);

      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalled();
    });

    it('should accept all query parameters together', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(
          `/v1/portfolio/${address}?fiatCode=EUR&chainIds=1,137&trusted=true&excludeDust=true&provider=zerion`,
        )
        .expect(200);

      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalled();
    });

    it('should return 422 for invalid address', async () => {
      await request(app.getHttpServer())
        .get('/v1/portfolio/invalid-address')
        .expect(422);
    });

    it('should return 400 for invalid provider', async () => {
      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?provider=invalid`)
        .expect(400);
    });

    it('should return 422 for invalid chainIds', async () => {
      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?chainIds=abc,xyz`)
        .expect(422);
    });

    it('should return 400 for invalid trusted boolean', async () => {
      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?trusted=notaboolean`)
        .expect(400);
    });

    it('should return 400 for invalid excludeDust boolean', async () => {
      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?excludeDust=notaboolean`)
        .expect(400);
    });

    it('should return proper error message for invalid provider', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?provider=invalid-provider`)
        .expect(400);

      expect(response.body.message).toContain('Invalid provider');
      expect(response.body.message).toContain('invalid-provider');
    });

    it('should handle API errors gracefully', async () => {
      zerionPortfolioApi.getPortfolio.mockRejectedValue(
        new Error('API service unavailable'),
      );

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .expect(500);
    });

    it('should filter by chain IDs correctly', async () => {
      const tokenInfo1 = tokenInfoBuilder().with('chainId', '1').with('trusted', true).build();
      const token1 = tokenBalanceBuilder()
        .with('tokenInfo', tokenInfo1)
        .with('balanceFiat', 100)
        .build();

      const tokenInfo2 = tokenInfoBuilder().with('chainId', '10').with('trusted', true).build();
      const token2 = tokenBalanceBuilder()
        .with('tokenInfo', tokenInfo2)
        .with('balanceFiat', 200)
        .build();

      const portfolio = portfolioBuilder()
        .with('tokenBalances', [token1, token2])
        .with('positionBalances', [])
        .build();

      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      const response = await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?chainIds=1`)
        .expect(200);

      expect(response.body.tokenBalances).toHaveLength(1);
      expect(response.body.tokenBalances[0].tokenInfo.chainId).toBe('1');
    });

    it('should filter trusted tokens correctly', async () => {
      const trustedTokenInfo = tokenInfoBuilder().with('trusted', true).build();
      const trustedToken = tokenBalanceBuilder()
        .with('tokenInfo', trustedTokenInfo)
        .with('balanceFiat', 100)
        .build();

      const untrustedTokenInfo = tokenInfoBuilder().with('trusted', false).build();
      const untrustedToken = tokenBalanceBuilder()
        .with('tokenInfo', untrustedTokenInfo)
        .with('balanceFiat', 200)
        .build();

      const portfolio = portfolioBuilder()
        .with('tokenBalances', [trustedToken, untrustedToken])
        .with('positionBalances', [])
        .build();

      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      const response = await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?trusted=true`)
        .expect(200);

      expect(response.body.tokenBalances).toHaveLength(1);
      expect(response.body.tokenBalances[0].tokenInfo.trusted).toBe(true);
    });

    it('should filter dust positions correctly', async () => {
      const largeTokenInfo = tokenInfoBuilder().with('trusted', true).build();
      const largeToken = tokenBalanceBuilder()
        .with('tokenInfo', largeTokenInfo)
        .with('balanceFiat', 10.0)
        .build();

      const dustTokenInfo = tokenInfoBuilder().with('trusted', true).build();
      const dustToken = tokenBalanceBuilder()
        .with('tokenInfo', dustTokenInfo)
        .with('balanceFiat', 0.5)
        .build();

      const portfolio = portfolioBuilder()
        .with('tokenBalances', [largeToken, dustToken])
        .with('positionBalances', [])
        .build();

      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      const response = await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?excludeDust=true`)
        .expect(200);

      expect(response.body.tokenBalances).toHaveLength(1);
      expect(response.body.tokenBalances[0].balanceFiat).toBe(10.0);
    });

    it('should return empty portfolio when no data available', async () => {
      const emptyPortfolio = portfolioBuilder()
        .with('tokenBalances', [])
        .with('positionBalances', [])
        .with('totalBalanceFiat', 0)
        .with('totalTokenBalanceFiat', 0)
        .with('totalPositionsBalanceFiat', 0)
        .build();

      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(emptyPortfolio));

      const response = await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .expect(200);

      expect(response.body.tokenBalances).toHaveLength(0);
      expect(response.body.positionBalances).toHaveLength(0);
      expect(response.body.totalBalanceFiat).toBe(0);
    });

    it('should handle checksummed addresses', async () => {
      const checksumAddress = getAddress(faker.finance.ethereumAddress());
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${checksumAddress}`)
        .expect(200);

      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalledWith({
        address: checksumAddress,
        fiatCode: 'USD',
        trusted: true,
      });
    });

    it('should handle lowercase addresses by checksumming', async () => {
      const lowerCaseAddress = faker.finance.ethereumAddress().toLowerCase();
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${lowerCaseAddress}`)
        .expect(200);

      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalled();
    });

    it('should use cache on subsequent requests', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));
      zerionPortfolioApi.fetchPnL = jest.fn().mockResolvedValue(null);

      // First request
      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .expect(200);

      // Second request should use cache
      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .expect(200);

      // API should only be called once due to caching
      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /v1/portfolio/:address', () => {
    const address = getAddress(faker.finance.ethereumAddress());

    it('should clear portfolio cache and return 204', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/portfolio/${address}`)
        .expect(204);
    });

    it('should return 422 for invalid address', async () => {
      await request(app.getHttpServer())
        .delete('/v1/portfolio/invalid-address')
        .expect(422);
    });

    it('should handle checksummed addresses', async () => {
      const checksumAddress = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/portfolio/${checksumAddress}`)
        .expect(204);
    });

    it('should clear cache for all providers', async () => {
      const portfolio = portfolioBuilder().build();
      zerionPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));
      zapperPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      // Request with both providers to populate cache
      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?provider=zerion`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?provider=zapper`)
        .expect(200);

      // Clear cache
      await request(app.getHttpServer())
        .delete(`/v1/portfolio/${address}`)
        .expect(204);

      // Subsequent requests should hit API again
      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?provider=zerion`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}?provider=zapper`)
        .expect(200);

      // Each provider should have been called twice (before and after clear)
      expect(zerionPortfolioApi.getPortfolio).toHaveBeenCalledTimes(2);
      expect(zapperPortfolioApi.getPortfolio).toHaveBeenCalledTimes(2);
    });
  });
});
