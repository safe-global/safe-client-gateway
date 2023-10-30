import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { alertBuilder } from '@/routes/alerts/entities/__tests__/alerts.builder';
import { fakeTenderlySignature } from '@/routes/alerts/entities/__tests__/fakeTenderlySignature';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Alert } from '@/routes/alerts/entities/alert.dto.entity';

describe('Alerts (Unit)', () => {
  let app: INestApplication;
  let signingKey: string;

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
      .compile();

    app = moduleFixture.createNestApplication();
    const configurationService = moduleFixture.get(IConfigurationService);
    signingKey = configurationService.getOrThrow('alerts.signingKey');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 (OK) for valid signature/valid payload', async () => {
    const alert = alertBuilder().build();
    const timestamp = Date.now().toString();
    const signature = fakeTenderlySignature({
      signingKey,
      alert,
      timestamp,
    });

    await request(app.getHttpServer())
      .post('/alerts')
      .set('x-tenderly-signature', signature)
      .set('date', timestamp)
      .send(alert)
      .expect(200);
  });

  it('returns 400 (Bad Request) for valid signature/invalid payload', async () => {
    const alert = {};
    const timestamp = Date.now().toString();
    const signature = fakeTenderlySignature({
      signingKey,
      alert: alert as Alert,
      timestamp,
    });

    await request(app.getHttpServer())
      .post('/alerts')
      .set('x-tenderly-signature', signature)
      .set('date', timestamp)
      .send(alert)
      .expect(400);
  });

  it('returns 403 (Forbidden) for invalid signature/valid payload', async () => {
    const alert = alertBuilder().build();
    const timestamp = Date.now().toString();
    const signature = faker.string.alphanumeric({ length: 64 });

    await request(app.getHttpServer())
      .post('/alerts')
      .set('x-tenderly-signature', signature)
      .set('date', timestamp)
      .send(alert)
      .expect(403);
  });
});
