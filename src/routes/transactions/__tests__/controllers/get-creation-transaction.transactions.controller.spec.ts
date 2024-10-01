import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  creationTransactionBuilder,
  toJson as creationTransactionToJson,
} from '@/domain/safe/entities/__tests__/creation-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { Server } from 'net';
import request from 'supertest';

describe('Get creation transaction', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeAll(async () => {
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

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  beforeEach(() => jest.resetAllMocks());

  afterAll(async () => {
    await app.close();
  });

  it('should return the creation transaction', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const creationTransaction = creationTransactionBuilder().build();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getCreationTransactionUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/creation/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getCreationTransactionUrl:
          return Promise.resolve({
            data: creationTransactionToJson(creationTransaction),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/creation/`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          ...creationTransaction,
          created: creationTransaction.created.toISOString(),
        });
      });
  });

  // TODO: Review why the response status code is 503 instead of 404
  it.skip('should forward Transaction Service errors', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getCreationTransactionUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/creation/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getCreationTransactionUrl:
          return Promise.reject(
            new NetworkResponseError(new URL(getCreationTransactionUrl), {
              status: 404,
            } as Response),
          );
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/creation/`,
      )
      .expect(404);
  });

  it('should fail if the Transaction Service fails', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getCreationTransactionUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/creation/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getCreationTransactionUrl:
          return Promise.reject(new Error());
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/creation/`,
      )
      .expect(503);
  });

  it('should fail if the Config Service fails', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const creationTransaction = creationTransactionBuilder().build();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getCreationTransactionUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/creation/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.reject(new Error());
        case getCreationTransactionUrl:
          return Promise.resolve({
            data: creationTransactionToJson(creationTransaction),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/creation/`,
      )
      .expect(503);
  });
});
