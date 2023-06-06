import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../app.provider';
import { TestCacheModule } from '../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../domain.module';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { pageBuilder } from '../../domain/entities/__tests__/page.builder';
import { ValidationModule } from '../../validation/validation.module';
import { ChainsModule } from '../chains/chains.module';
import { TestLoggingModule } from '../../logging/__tests__/test.logging.module';
import { ContractsModule } from '../contracts/contracts.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { invalidationPatternDtoBuilder } from './entities/__tests__/invalidation-pattern.dto.builder';
import { FlushModule } from './flush.module';
import { ConfigurationModule } from '../../config/configuration.module';
import configuration from '../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { FakeCacheService } from '../../datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '../../datasources/cache/cache.service.interface';

describe('Flush Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;
  let authToken;
  let fakeCacheService: FakeCacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        FlushModule,
        ChainsModule,
        ContractsModule,
        TransactionsModule,
        // common
        DomainModule,
        TestCacheModule,
        ConfigurationModule.register(configuration),
        TestLoggingModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();

    fakeCacheService = moduleFixture.get<FakeCacheService>(CacheService);
    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    authToken = configurationService.get('auth.token');

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
    mockNetworkService.get.mockImplementation((url) => {
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
