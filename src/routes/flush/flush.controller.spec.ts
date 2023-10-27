import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { invalidationPatternDtoBuilder } from '@/routes/flush/entities/__tests__/invalidation-pattern.dto.builder';

describe('Flush Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;
  let authToken;
  let fakeCacheService: FakeCacheService;
  let networkService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.registerAsync(configuration)],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    fakeCacheService = moduleFixture.get<FakeCacheService>(CacheService);
    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    authToken = configurationService.get('auth.token');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should throw an error if authorization is not sent in the request headers', async () => {
    await request(app.getHttpServer()).post('/v2/flush').send({}).expect(403);
  });

  it('should throw an error for a malformed request', async () => {
    await request(app.getHttpServer())
      .post('/v2/flush')
      .set('Authorization', `Basic ${authToken}`)
      .send({})
      .expect(400);
  });

  it('should invalidate chains', async () => {
    const chains = [
      chainBuilder().with('chainId', '1').build(),
      chainBuilder().with('chainId', '2').build(),
    ];
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains`:
          return Promise.resolve({
            data: pageBuilder().with('results', chains).build(),
          });
        case `${safeConfigUrl}/api/v1/chains/${chains[0].chainId}`:
          return Promise.resolve({ data: chains[0] });
        case `${safeConfigUrl}/api/v1/chains/${chains[1].chainId}`:
          return Promise.resolve({ data: chains[1] });
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    // fill cache by requesting chains
    await request(app.getHttpServer()).get('/v1/chains');
    await request(app.getHttpServer()).get(`/v1/chains/${chains[0].chainId}`);
    await request(app.getHttpServer()).get(`/v1/chains/${chains[1].chainId}`);

    // check the cache is filled
    expect(fakeCacheService.keyCount()).toBe(3);

    // execute flush
    await request(app.getHttpServer())
      .post('/v2/flush')
      .set('Authorization', `Basic ${authToken}`)
      .send(
        invalidationPatternDtoBuilder().with('invalidate', 'Chains').build(),
      )
      .expect(200);

    // check the cache is empty
    expect(fakeCacheService.keyCount()).toBe(0);
  });
});
