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
import { EventType } from '@/routes/alerts/entities/alert.dto.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

describe('Alerts (Unit)', () => {
  let app: INestApplication;
  let loggingService: ILoggingService;

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
    loggingService = moduleFixture.get(LoggingService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.todo('notifies about addOwnerWithThreshold attempts');
  it.todo('notifies about non-addOwnerWithThreshold attempts');
  it.todo('notifies about alerts with multiple logs');

  it('logs unknown alerts', async () => {
    const warnSpy = jest.spyOn(loggingService, 'warn');

    const alert = alertBuilder().with('event_type', EventType.ALERT).build();

    await request(app.getHttpServer()).post('/alerts').send(alert).expect(200);

    expect(warnSpy).toHaveBeenCalledWith('Unknown alert received');
  });

  it('returns 400 (Bad Request) for invalid payload', async () => {
    const data = {};

    await request(app.getHttpServer()).post('/alerts').send(data).expect(400);
  });
});
