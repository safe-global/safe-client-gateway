import configuration from '@/config/entities/__tests__/configuration';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import type { INestApplication } from '@nestjs/common';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import request from 'supertest';
import type { IQueueReadiness } from '@/domain/interfaces/queue-readiness.interface';
import { QueueReadiness } from '@/domain/interfaces/queue-readiness.interface';
import type { Server } from 'net';
import { createTestModule } from '@/__tests__/testing-module';

describe('Health Controller tests', () => {
  let app: INestApplication<Server>;
  let cacheService: FakeCacheService;
  let queuesApi: jest.MockedObjectDeep<IQueueReadiness>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule({
      config: configuration,
    });

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
    it('cache service is not ready', async () => {
      cacheService.setReadyState(false);
      queuesApi.isReady.mockReturnValue(true);

      await request(app.getHttpServer())
        .get(`/health/live`)
        .expect(503)
        .expect({ status: 'KO' });
    });

    it('queues are not ready', async () => {
      cacheService.setReadyState(true);
      queuesApi.isReady.mockReturnValue(false);

      await request(app.getHttpServer())
        .get(`/health/live`)
        .expect(503)
        .expect({ status: 'KO' });
    });

    it('service is alive if it accepts requests, cache service and queues are ready', async () => {
      cacheService.setReadyState(true);
      queuesApi.isReady.mockReturnValue(true);

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
