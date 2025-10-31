import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { Server } from 'net';
import type { INestApplication } from '@nestjs/common';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { PortfolioApiService } from '@/routes/portfolio/portfolio.service';
import { PortfolioController } from '@/routes/portfolio/portfolio.controller';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { PortfolioRouteMapper } from '@/routes/portfolio/portfolio.mapper';

describe('PortfolioController', () => {
  let app: INestApplication<Server>;
  let portfolioService: jest.MockedObjectDeep<PortfolioApiService>;
  let portfolioRouteMapper: PortfolioRouteMapper;

  beforeEach(async () => {
    jest.resetAllMocks();

    portfolioRouteMapper = new PortfolioRouteMapper();

    const mockPortfolioService = {
      getPortfolio: jest.fn(),
      clearPortfolio: jest.fn(),
    } as unknown as jest.MockedObjectDeep<PortfolioApiService>;

    const moduleFixture = await Test.createTestingModule({
      imports: [ConfigurationModule.register(configuration)],
      controllers: [PortfolioController],
      providers: [
        {
          provide: PortfolioApiService,
          useValue: mockPortfolioService,
        },
      ],
    }).compile();

    portfolioService = moduleFixture.get(PortfolioApiService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/portfolio/:address', () => {
    it('should return portfolio for address with default parameters', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const domainPortfolio = portfolioBuilder().build();
      const portfolio = portfolioRouteMapper.mapDomainToRoute(domainPortfolio);

      portfolioService.getPortfolio.mockResolvedValue(portfolio);

      const response = await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .expect(200);

      expect(portfolioService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode: 'USD',
        chainIds: undefined,
        trusted: true,
        excludeDust: true,
      });

      expect(response.body).toMatchObject({
        totalBalanceFiat: portfolio.totalBalanceFiat,
        totalTokenBalanceFiat: portfolio.totalTokenBalanceFiat,
        totalPositionsBalanceFiat: portfolio.totalPositionsBalanceFiat,
      });
    });

    it('should accept fiatCode query parameter', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = 'EUR';
      const domainPortfolio = portfolioBuilder().build();
      const portfolio = portfolioRouteMapper.mapDomainToRoute(domainPortfolio);

      portfolioService.getPortfolio.mockResolvedValue(portfolio);

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .query({ fiatCode })
        .expect(200);

      expect(portfolioService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode,
        chainIds: undefined,
        trusted: true,
        excludeDust: true,
      });
    });

    it('should accept chainIds query parameter', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainIds = '1,10,137';
      const domainPortfolio = portfolioBuilder().build();
      const portfolio = portfolioRouteMapper.mapDomainToRoute(domainPortfolio);

      portfolioService.getPortfolio.mockResolvedValue(portfolio);

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .query({ chainIds })
        .expect(200);

      expect(portfolioService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode: 'USD',
        chainIds: ['1', '10', '137'],
        trusted: true,
        excludeDust: true,
      });
    });

    it('should accept trusted query parameter', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const domainPortfolio = portfolioBuilder().build();
      const portfolio = portfolioRouteMapper.mapDomainToRoute(domainPortfolio);

      portfolioService.getPortfolio.mockResolvedValue(portfolio);

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .query({ trusted: 'false' })
        .expect(200);

      expect(portfolioService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode: 'USD',
        chainIds: undefined,
        trusted: false,
        excludeDust: true,
      });
    });

    it('should accept excludeDust query parameter', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const domainPortfolio = portfolioBuilder().build();
      const portfolio = portfolioRouteMapper.mapDomainToRoute(domainPortfolio);

      portfolioService.getPortfolio.mockResolvedValue(portfolio);

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .query({ excludeDust: 'false' })
        .expect(200);

      expect(portfolioService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode: 'USD',
        chainIds: undefined,
        trusted: true,
        excludeDust: false,
      });
    });

    it('should accept all query parameters together', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const domainPortfolio = portfolioBuilder().build();
      const portfolio = portfolioRouteMapper.mapDomainToRoute(domainPortfolio);

      portfolioService.getPortfolio.mockResolvedValue(portfolio);

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .query({
          fiatCode: 'EUR',
          chainIds: '1,10',
          trusted: 'false',
          excludeDust: 'false',
        })
        .expect(200);

      expect(portfolioService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode: 'EUR',
        chainIds: ['1', '10'],
        trusted: false,
        excludeDust: false,
      });
    });

    it('should return portfolio with groups structure', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const domainPortfolio = portfolioBuilder().build();
      const portfolio = portfolioRouteMapper.mapDomainToRoute(domainPortfolio);

      portfolioService.getPortfolio.mockResolvedValue(portfolio);

      const response = await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .expect(200);

      expect(response.body.positionBalances).toBeDefined();
      expect(Array.isArray(response.body.positionBalances)).toBe(true);

      if (response.body.positionBalances.length > 0) {
        expect(response.body.positionBalances[0].groups).toBeDefined();
        expect(Array.isArray(response.body.positionBalances[0].groups)).toBe(
          true,
        );
      }
    });
  });

  describe('DELETE /v1/portfolio/:address', () => {
    it('should clear portfolio cache', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      portfolioService.clearPortfolio.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/v1/portfolio/${address}`)
        .expect(204);

      expect(portfolioService.clearPortfolio).toHaveBeenCalledWith({
        address,
      });
    });
  });
});
