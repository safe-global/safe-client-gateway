import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { alertBuilder } from '@/routes/alerts/entities/__tests__/alerts.builder';
import { TenderlySignatureGuard } from '@/routes/alerts/guards/tenderly-signature.guard';

describe('Alerts (Unit)', () => {
  let app: INestApplication;
  let canActive: boolean;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideGuard(TenderlySignatureGuard)
      .useValue({ canActivate: () => canActive })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 (OK) for valid signature/valid payload', async () => {
    canActive = true;
    const alert = alertBuilder().build();

    await request(app.getHttpServer()).post('/alerts').send(alert).expect(200);
  });

  it('returns 400 (Bad Request) for valid signature/invalid payload', async () => {
    canActive = true;
    const alert = {};

    await request(app.getHttpServer()).post('/alerts').send(alert).expect(400);
  });

  it('returns 403 (Forbidden) for invalid signature/valid payload', async () => {
    canActive = false;
    const alert = alertBuilder().build();

    await request(app.getHttpServer()).post('/alerts').send(alert).expect(403);
  });
});
