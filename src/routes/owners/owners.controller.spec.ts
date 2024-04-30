import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { getAddress } from 'viem';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';

describe('Owners Controller (Unit)', () => {
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
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET safes by owner address', () => {
    it(`Success`, async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const transactionApiSafeListResponse = {
        safes: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
      };
      networkService.get.mockResolvedValueOnce({
        data: chainResponse,
        status: 200,
      });
      networkService.get.mockResolvedValueOnce({
        data: transactionApiSafeListResponse,
        status: 200,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          // Validation schema checksums addresses
          safes: transactionApiSafeListResponse.safes.map((safe) =>
            getAddress(safe),
          ),
        });
    });

    it('Failure: Config API fails', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      const error = new NetworkResponseError(
        new URL(
          `${safeConfigUrl}/v1/chains/${chainId}/owners/${ownerAddress}/safes`,
        ),
        {
          status: 500,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/owners/${ownerAddress}/safes`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains/${chainId}`,
      });
    });

    it('Failure: Transaction API fails', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      networkService.get.mockResolvedValueOnce({
        data: chainResponse,
        status: 200,
      });
      const error = new NetworkResponseError(
        new URL(
          `${chainResponse.transactionService}/v1/chains/${chainId}/owners/${ownerAddress}/safes`,
        ),
        {
          status: 500,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/owners/${ownerAddress}/safes`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains/${chainId}`,
      });
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${chainResponse.transactionService}/api/v1/owners/${ownerAddress}/safes/`,
      });
    });

    it('Failure: data validation fails', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const transactionApiSafeListResponse = {
        safes: [
          faker.finance.ethereumAddress(),
          faker.number.int(),
          faker.finance.ethereumAddress(),
        ],
      };
      networkService.get.mockResolvedValueOnce({
        data: chainResponse,
        status: 200,
      });
      networkService.get.mockResolvedValueOnce({
        data: transactionApiSafeListResponse,
        status: 200,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/owners/${ownerAddress}/safes`)
        .expect(500)
        .expect({
          statusCode: 500,
          message: 'Internal server error',
        });
    });
  });

  describe('GET all safes by owner address', () => {
    it('Success', async () => {
      const ownerAddress = faker.finance.ethereumAddress();

      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });

      const chain1 = chainBuilder().with('chainId', chainId1).build();
      const chain2 = chainBuilder().with('chainId', chainId2).build();

      const safesOnChain1 = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];
      const safesOnChain2 = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains`: {
            return Promise.resolve({
              data: pageBuilder().with('results', [chain1, chain2]).build(),
              status: 200,
            });
          }

          case `${safeConfigUrl}/api/v1/chains/${chainId1}`: {
            return Promise.resolve({
              data: chain1,
              status: 200,
            });
          }

          case `${safeConfigUrl}/api/v1/chains/${chainId2}`: {
            return Promise.resolve({
              data: chain2,
              status: 200,
            });
          }

          case `${chain1.transactionService}/api/v1/owners/${ownerAddress}/safes/`: {
            return Promise.resolve({
              data: { safes: safesOnChain1 },
              status: 200,
            });
          }

          case `${chain2.transactionService}/api/v1/owners/${ownerAddress}/safes/`: {
            return Promise.resolve({
              data: { safes: safesOnChain2 },
              status: 200,
            });
          }

          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          // Validation schema checksums addresses
          [chainId1]: safesOnChain1.map((safe) => getAddress(safe)),
          [chainId2]: safesOnChain2.map((safe) => getAddress(safe)),
        });
    });

    it('Failure: Config API fails', async () => {
      const ownerAddress = faker.finance.ethereumAddress();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains`) {
          const error = new NetworkResponseError(
            new URL(`${safeConfigUrl}/api/v1/chains`),
            {
              status: 500,
            } as Response,
          );
          return Promise.reject(error);
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/owners/${ownerAddress}/safes`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains`,
        networkRequest: { params: { limit: undefined, offset: undefined } },
      });
    });

    it('Failure: data validation fails', async () => {
      const ownerAddress = faker.finance.ethereumAddress();

      const chainId = faker.string.numeric();

      const chain = chainBuilder().with('chainId', chainId).build();

      const safesOnChain = [
        faker.finance.ethereumAddress(),
        faker.number.int(),
        faker.finance.ethereumAddress(),
      ];

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains`: {
            return Promise.resolve({
              data: {
                results: [chain],
              },
              status: 200,
            });
          }

          case `${safeConfigUrl}/api/v1/chains/${chainId}`: {
            return Promise.resolve({
              data: chain,
              status: 200,
            });
          }

          case `${chain.transactionService}/api/v1/owners/${ownerAddress}/safes/`: {
            return Promise.resolve({
              data: { safes: safesOnChain },
              status: 200,
            });
          }

          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/owners/${ownerAddress}/safes`)
        .expect(500)
        .expect({
          statusCode: 500,
          message: 'Internal server error',
        });
    });
  });
});
