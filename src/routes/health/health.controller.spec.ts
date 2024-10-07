import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import type { INestApplication } from '@nestjs/common';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import request from 'supertest';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import type { IQueueReadiness } from '@/domain/interfaces/queue-readiness.interface';
import { QueueReadiness } from '@/domain/interfaces/queue-readiness.interface';
import type { Server } from 'net';

describe('Health Controller tests', () => {
  let app: INestApplication<Server>;
  let cacheService: FakeCacheService;
  let queuesApi: jest.MockedObjectDeep<IQueueReadiness>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    app = await new TestAppProvider().provide(moduleFixture);

    cacheService = moduleFixture.get(CacheService);
    queuesApi = moduleFixture.get(QueueReadiness);

    await app.init();
  });

  describe('readiness tests', () => {
    it('cache service is not ready', async () => {
      cacheService.setReadyState(false);
      queuesApi.isReady.mockReturnValue(true);

      await request(app.getHttpServer())
        .get(`/health/ready`)
        .expect(503)
        .expect({ status: 'KO' });
    });

    it('queues are not ready', async () => {
      cacheService.setReadyState(true);
      queuesApi.isReady.mockReturnValue(false);

      await request(app.getHttpServer())
        .get(`/health/ready`)
        .expect(503)
        .expect({ status: 'KO' });
    });

    it('cache service and queues are ready', async () => {
      cacheService.setReadyState(true);
      queuesApi.isReady.mockReturnValue(true);

      await request(app.getHttpServer())
        .get(`/health/ready`)
        .expect(200)
        .expect({ status: 'OK' });
    });
  });

  describe('liveness tests', () => {
    it('service is alive if it accepts requests', async () => {
      await request(app.getHttpServer())
        .get(`/health/live`)
        .expect(200)
        .expect({ status: 'OK' });
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
