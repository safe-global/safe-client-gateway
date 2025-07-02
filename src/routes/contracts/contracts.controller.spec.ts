import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/data-decoder/v2/entities/__tests__/contract.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';

describe('Contracts controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let safeDataDecoderUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    safeDataDecoderUrl = configurationService.getOrThrow(
      'safeDataDecoder.baseUri',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET contract data for an address', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      const contractPage = pageBuilder().with('results', [contract]).build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${safeDataDecoderUrl}/api/v1/contracts/${contract.address}`:
            return Promise.resolve({
              data: rawify(contractPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(200)
        .expect({
          address: contract.address,
          contractAbi: {
            abi: contract.abi?.abiJson,
          },
          displayName: contract.displayName,
          logoUri: contract.logoUrl,
          name: contract.name,
          trustedForDelegateCall: contract.trustedForDelegateCall,
        });
    });

    it('Failure: Config API fails', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.reject(new Error());
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(503);
    });

    it('Failure: Decoder API fails', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case safeDataDecoderUrl:
            return Promise.reject(
              new NetworkResponseError(new URL(safeDataDecoderUrl), {
                status: 503,
              } as Response),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(503);
    });

    it('Should pass validation if name is null', async () => {    
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      const contractPage = pageBuilder()
        .with('results', [{ ...contract, name: null }])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${safeDataDecoderUrl}/api/v1/contracts/${contract.address}`:
            return Promise.resolve({
              data: rawify(contractPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(200)
        .expect({
          address: contract.address,
          name: '',
          displayName: contract.displayName,
          logoUri: contract.logoUrl,
          contractAbi: {
            abi: contract.abi?.abiJson,
          },
          trustedForDelegateCall: contract.trustedForDelegateCall,
        });
    });

    it('should get a validation error', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      const contractPage = pageBuilder()
        .with('results', [{ ...contract, address: false }])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${safeDataDecoderUrl}/api/v1/contracts/${contract.address}`:
            return Promise.resolve({
              data: rawify(contractPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });
  });
});
