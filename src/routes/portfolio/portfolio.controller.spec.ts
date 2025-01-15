import { Test } from '@nestjs/testing';
import { getAddress } from 'viem';
import { faker } from '@faker-js/faker';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { PortfolioMapper } from '@/routes/portfolio/mappers/portfolio.mapper';
import request from 'supertest';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import type { INetworkService } from '@/datasources/network/network.service.interface';

describe('PortfolioController', () => {
  let app: INestApplication<Server>;
  let portfolioApiUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  const chains = Object.entries(PortfolioMapper.ChainKeys) as Array<
    [keyof typeof PortfolioMapper.ChainKeys, string]
  >;

  beforeAll(async () => {
    const baseConfig = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...baseConfig,
      features: {
        ...baseConfig.features,
        portfolio: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    portfolioApiUrl = configurationService.getOrThrow('portfolio.baseUri');
    networkService = moduleFixture.get(NetworkService);
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return the mapped portfolio', async () => {
    const [key, chainId] = faker.helpers.arrayElement(chains);
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const portfolio = portfolioBuilder().build();
    networkService.get.mockImplementationOnce(({ url, networkRequest }) => {
      if (
        url === `${portfolioApiUrl}/api/rest/portfolio` &&
        networkRequest?.params?.addresses === safeAddress
      ) {
        return Promise.resolve({
          data: rawify({ getPortfolio: [portfolio] }),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/portfolio`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          results: expect.any(Array),
          count: Object.values(portfolio.assetByProtocols).reduce(
            (acc, cur) => {
              const chain = cur.chains[key];
              if (chain) {
                acc += Object.values(chain.protocolPositions).length;
              }
              return acc;
            },
            0,
          ),
          next: null,
          previous: null,
        });
      });
  });

  it.todo('should fail on API errors');

  it.todo('should fail on validation errors');

  it.todo('should fail on unsupported chains');

  it.todo('should fail with unsupported positions');
});
