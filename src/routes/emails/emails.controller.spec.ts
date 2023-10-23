import { INestApplication } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { getAddress, hashMessage } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { AppModule, configurationModule } from '@/app.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';

describe('Emails controller', () => {
  let app: INestApplication;
  let safeConfigUrl;
  let networkService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(configurationModule)
      .useModule(ConfigurationModule.register(configuration))
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

  describe('POST register email address for a Safe', () => {
    it('Success', async () => {
      const chainResponse = chainBuilder().build();
      const chainId = chainResponse.chainId;
      const safeAddress = faker.finance.ethereumAddress();

      const emailAddress = faker.internet.email();

      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const signer = account.address;

      const timestamp = Date.now();
      const message = chainId + getAddress(safeAddress) + timestamp;
      const signature = await account.signMessage({
        message: hashMessage(message),
      });

      const transactionApiSafeResponse: Safe = {
        address: safeAddress,
        fallbackHandler: faker.finance.ethereumAddress(),
        guard: faker.finance.ethereumAddress(),
        masterCopy: faker.finance.ethereumAddress(),
        modules: null,
        nonce: 0,
        threshold: 1,
        version: null,
        owners: [signer],
      };

      networkService.get.mockImplementation((url: string) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chainId}`) {
          return Promise.resolve({ data: chainResponse });
        }

        if (
          url ===
          `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`
        ) {
          return Promise.resolve({ data: transactionApiSafeResponse });
        }

        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/safes/${safeAddress}/emails`)
        .send({
          emailAddress,
          signature,
          timestamp,
        })
        .expect(200)
        .expect(emailAddress);
    });

    it('should not allow non-owner signatures', async () => {
      const chainResponse = chainBuilder().build();
      const chainId = chainResponse.chainId;
      const safeAddress = faker.finance.ethereumAddress();

      const emailAddress = faker.internet.email();

      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      const timestamp = Date.now();
      const message = chainId + getAddress(safeAddress) + timestamp;
      const signature = await account.signMessage({
        message: hashMessage(message),
      });

      const transactionApiSafeResponse: Safe = {
        address: safeAddress,
        fallbackHandler: faker.finance.ethereumAddress(),
        guard: faker.finance.ethereumAddress(),
        masterCopy: faker.finance.ethereumAddress(),
        modules: null,
        nonce: 0,
        threshold: 1,
        version: null,
        owners: [faker.finance.ethereumAddress()], // Not signer
      };

      networkService.get.mockImplementation((url: string) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chainId}`) {
          return Promise.resolve({ data: chainResponse });
        }

        if (
          url ===
          `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`
        ) {
          return Promise.resolve({ data: transactionApiSafeResponse });
        }

        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/safes/${safeAddress}/emails`)
        .send({
          emailAddress,
          signature,
          timestamp,
        })
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });
  });

  it('should not allow timestamps > 5 minutes in the past', async () => {
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const safeAddress = faker.finance.ethereumAddress();

    const emailAddress = faker.internet.email();

    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const signer = account.address;

    const timestamp = Date.now() - 6 * 60 * 1_000; // 6 minutes in the past
    const message = chainId + getAddress(safeAddress) + timestamp;
    const signature = await account.signMessage({
      message: hashMessage(message),
    });

    const transactionApiSafeResponse: Safe = {
      address: safeAddress,
      fallbackHandler: faker.finance.ethereumAddress(),
      guard: faker.finance.ethereumAddress(),
      masterCopy: faker.finance.ethereumAddress(),
      modules: null,
      nonce: 0,
      threshold: 1,
      version: null,
      owners: [signer],
    };

    networkService.get.mockImplementation((url: string) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chainId}`) {
        return Promise.resolve({ data: chainResponse });
      }

      if (
        url ===
        `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`
      ) {
        return Promise.resolve({ data: transactionApiSafeResponse });
      }

      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/safes/${safeAddress}/emails`)
      .send({
        emailAddress,
        signature,
        timestamp,
      })
      .expect(400)
      .expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });
  });

  it('should not allow timestamps > 5 minutes in the future', async () => {
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const safeAddress = faker.finance.ethereumAddress();

    const emailAddress = faker.internet.email();

    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const signer = account.address;

    const timestamp = Date.now() + 5 * 60 * 1_000 - 1; // 6 minutes in the future
    const message = chainId + getAddress(safeAddress) + timestamp;
    const signature = await account.signMessage({
      message: hashMessage(message),
    });

    const transactionApiSafeResponse: Safe = {
      address: safeAddress,
      fallbackHandler: faker.finance.ethereumAddress(),
      guard: faker.finance.ethereumAddress(),
      masterCopy: faker.finance.ethereumAddress(),
      modules: null,
      nonce: 0,
      threshold: 1,
      version: null,
      owners: [signer],
    };

    networkService.get.mockImplementation((url: string) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chainId}`) {
        return Promise.resolve({ data: chainResponse });
      }

      if (
        url ===
        `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`
      ) {
        return Promise.resolve({ data: transactionApiSafeResponse });
      }

      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/safes/${safeAddress}/emails`)
      .send({
        emailAddress,
        signature,
        timestamp,
      })
      .expect(400)
      .expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });
  });
});
