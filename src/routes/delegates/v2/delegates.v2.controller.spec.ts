import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { getAddress } from 'viem';

describe('Delegates controller', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
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
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  describe('GET delegates for a Safe (v2)', () => {
    it('Success', async () => {
      const safe = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 2)
        .with('next', null)
        .with('previous', null)
        .with('results', [
          delegateBuilder().with('safe', safe).build(),
          delegateBuilder().with('safe', safe).build(),
        ])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({ data: delegatesPage, status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('Should return a validation error', async () => {
      const safe = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 2)
        .with('next', null)
        .with('previous', null)
        .with('results', [
          delegateBuilder().with('safe', safe).build(),
          { ...delegateBuilder().with('safe', safe).build(), label: true },
        ])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({ data: delegatesPage, status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(500)
        .expect({
          statusCode: 500,
          message: 'Internal server error',
        });
    });

    it('Should return empty result', async () => {
      const safe = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 0)
        .with('next', null)
        .with('previous', null)
        .with('results', [])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({ data: delegatesPage, status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('Should fail with bad request', async () => {
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/delegates`)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'At least one property is required',
          path: [],
        });
    });
  });
});
