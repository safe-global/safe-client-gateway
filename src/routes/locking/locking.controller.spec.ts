import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';

describe('Locking (Unit)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /locking/leaderboard/rank/:safeAddress', () => {
    it('should return 302 and redirect to the new endpoint', async () => {
      const safeAddress = faker.finance.ethereumAddress();

      await request(app.getHttpServer())
        .get(`/v1/locking/leaderboard/rank/${safeAddress}`)
        .expect(308)
        .expect((res) => {
          expect(res.get('location')).toBe(
            `/v1/community/locking/${safeAddress}/rank`,
          );
        });
    });
  });

  describe('GET /locking/leaderboard', () => {
    it('should return 302 and redirect to the new endpoint', async () => {
      await request(app.getHttpServer())
        .get('/v1/locking/leaderboard')
        .expect(308)
        .expect((res) => {
          expect(res.get('location')).toBe('/v1/community/locking/leaderboard');
        });
    });

    it('should return 302 and redirect to the new endpoint with cursor', async () => {
      const cursor = 'limit%3Daa%26offset%3D2';

      await request(app.getHttpServer())
        .get(`/v1/locking/leaderboard/?cursor=${cursor}`)
        .expect(308)
        .expect((res) => {
          expect(res.get('location')).toBe(
            `/v1/community/locking/leaderboard/?cursor=${cursor}`,
          );
        });
    });
  });

  describe('GET /locking/:safeAddress/history', () => {
    it('should return 302 and redirect to the new endpoint', async () => {
      const safeAddress = faker.finance.ethereumAddress();

      await request(app.getHttpServer())
        .get(`/v1/locking/${safeAddress}/history`)
        .expect(308)
        .expect((res) => {
          expect(res.get('location')).toBe(
            `/v1/community/locking/${safeAddress}/history`,
          );
        });
    });

    it('should return 302 and redirect to the new endpoint with cursor', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const cursor = 'limit%3Daa%26offset%3D2';

      await request(app.getHttpServer())
        .get(`/v1/locking/${safeAddress}/history/?cursor=${cursor}`)
        .expect(308)
        .expect((res) => {
          expect(res.get('location')).toBe(
            `/v1/community/locking/${safeAddress}/history/?cursor=${cursor}`,
          );
        });
    });
  });
});
