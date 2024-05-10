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
import { getAddress } from 'viem';
import { rankBuilder } from '@/domain/locking/entities/__tests__/rank.builder';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { Server } from 'net';

describe('Locking (Unit)', () => {
  let app: INestApplication<Server>;
  let lockingBaseUri: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

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

    const configurationService = moduleFixture.get(IConfigurationService);
    lockingBaseUri = configurationService.get('locking.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET rank', () => {
    it('should get the rank', async () => {
      const rank = rankBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard/${rank.holder}`:
            return Promise.resolve({ data: rank, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/locking/leaderboard/rank/${rank.holder}`)
        .expect(200)
        .expect(rank);
    });

    it('should validate the Safe address in URL', async () => {
      const safeAddress = faker.string.alphanumeric();

      await request(app.getHttpServer())
        .get(`/v1/locking/leaderboard/rank/${safeAddress}`)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid address',
          path: [],
        });
    });

    it('should validate the response', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const rank = { invalid: 'rank' };
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard/${safeAddress}`:
            return Promise.resolve({ data: rank, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/locking/leaderboard/rank/${safeAddress}`)
        .expect(500)
        .expect({
          statusCode: 500,
          message: 'Internal server error',
        });
    });

    it('should forward an error from the service', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard/${safeAddress}`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(`${lockingBaseUri}/api/v1/leaderboard/${safeAddress}`),
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
        .get(`/v1/locking/leaderboard/rank/${safeAddress}`)
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });

  describe('GET leaderboard', () => {
    it('should get the leaderboard', async () => {
      const leaderboard = pageBuilder()
        .with('results', [rankBuilder().build()])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard`:
            return Promise.resolve({ data: leaderboard, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/locking/leaderboard`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            count: leaderboard.count,
            next: expect.any(String),
            previous: expect.any(String),
            results: leaderboard.results,
          });
        });

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/leaderboard`,
        networkRequest: {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      });
    });

    it('should forward the pagination parameters', async () => {
      const limit = faker.number.int({ min: 1, max: 10 });
      const offset = faker.number.int({ min: 1, max: 10 });
      const leaderboard = pageBuilder()
        .with('results', [rankBuilder().build()])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard`:
            return Promise.resolve({ data: leaderboard, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/locking/leaderboard?cursor=limit%3D${limit}%26offset%3D${offset}`,
        )
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            count: leaderboard.count,
            next: expect.any(String),
            previous: expect.any(String),
            results: leaderboard.results,
          });
        });

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/leaderboard`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should validate the response', async () => {
      const leaderboard = pageBuilder()
        .with('results', [{ invalid: 'rank' }])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard`:
            return Promise.resolve({ data: leaderboard, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/locking/leaderboard`)
        .expect(500)
        .expect({
          statusCode: 500,
          message: 'Internal server error',
        });
    });

    it('should forward an error from the service', async () => {
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(`${lockingBaseUri}/api/v1/leaderboard`),
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
        .get(`/v1/locking/leaderboard`)
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });

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
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          // Service will have checksummed address
          case `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`:
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

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`,
        networkRequest: {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      });
    });

    it('should forward the pagination parameters', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const limit = faker.number.int({ min: 1, max: 10 });
      const offset = faker.number.int({ min: 1, max: 10 });
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
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          // Service will have checksummed address
          case `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`:
            return Promise.resolve({ data: lockingHistoryPage, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/locking/${safeAddress}/history?cursor=limit%3D${limit}%26offset%3D${offset}`,
        )
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

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should validate the Safe address in URL', async () => {
      const safeAddress = faker.string.alphanumeric();

      await request(app.getHttpServer())
        .get(`/v1/locking/${safeAddress}/history`)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid address',
          path: [],
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
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          // Service will have checksummed address
          case `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`:
            return Promise.resolve({ data: lockingHistoryPage, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/locking/${safeAddress}/history`)
        .expect(500)
        .expect({
          statusCode: 500,
          message: 'Internal server error',
        });
    });

    it('should forward an error from the service', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`:
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
