import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  lockEventItemBuilder,
  unlockEventItemBuilder,
  withdrawEventItemBuilder,
} from '@/domain/locking/entities/__tests__/locking-event.builder';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';

describe('Locking (Unit)', () => {
  let app: INestApplication;
  let lockingBaseUri: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        locking: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    lockingBaseUri = configurationService.get('locking.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.todo('GET rank');

  it.todo('GET leaderboard');

  describe('GET locking history', () => {
    it('should get locking history', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const lockingHistory = [
        lockEventItemBuilder().build(),
        unlockEventItemBuilder().build(),
        withdrawEventItemBuilder().build(),
      ];
      const lockingHistoryPage = pageBuilder<LockingEvent>()
        .with('results', lockingHistory)
        .with('count', lockingHistory.length)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/all-events/${safeAddress}`:
            return Promise.resolve({ data: lockingHistoryPage, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/locking/${safeAddress}/history`)
        .expect(200)
        .expect({
          count: lockingHistoryPage.count,
          next: null,
          previous: null,
          results: lockingHistoryPage.results.map((result) => ({
            ...result,
            executionDate: result.executionDate.toISOString(),
          })),
        });
    });

    it('should validate the response', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const invalidLockingHistory = [{ invalid: 'value' }];
      const lockingHistoryPage = pageBuilder()
        .with('results', invalidLockingHistory)
        .with('count', invalidLockingHistory.length)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/all-events/${safeAddress}`:
            return Promise.resolve({ data: lockingHistoryPage, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/locking/${safeAddress}/history`)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_union_discriminator',
          options: ['LOCKED', 'UNLOCKED', 'WITHDRAWN'],
          path: ['results', 0, 'eventType'],
          message:
            "Invalid discriminator value. Expected 'LOCKED' | 'UNLOCKED' | 'WITHDRAWN'",
        });
    });

    it('should forward an error from the service', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/all-events/${safeAddress}`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(`${lockingBaseUri}/v1/locking/${safeAddress}/history`),
                {
                  status: statusCode,
                } as Response,
                { message: errorMessage, status: statusCode },
              ),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/locking/${safeAddress}/history`)
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });
});
