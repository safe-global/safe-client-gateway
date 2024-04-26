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
import { addRecoveryModuleDtoBuilder } from '@/routes/recovery/entities/__tests__/add-recovery-module.dto.builder';
import configuration from '@/config/entities/__tests__/configuration';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  AlertsApiConfigurationModule,
  ALERTS_API_CONFIGURATION_MODULE,
} from '@/datasources/alerts-api/configuration/alerts-api.configuration.module';
import alertsApiConfiguration from '@/datasources/alerts-api/configuration/__tests__/alerts-api.configuration';
import {
  AlertsConfigurationModule,
  ALERTS_CONFIGURATION_MODULE,
} from '@/routes/alerts/configuration/alerts.configuration.module';
import alertsConfiguration from '@/routes/alerts/configuration/__tests__/alerts.configuration';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';

describe('Recovery (Unit)', () => {
  let app: INestApplication;
  let alertsUrl: string;
  let alertsAccount: string;
  let alertsProject: string;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        email: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(ALERTS_CONFIGURATION_MODULE)
      .useModule(AlertsConfigurationModule.register(alertsConfiguration))
      .overrideModule(ALERTS_API_CONFIGURATION_MODULE)
      .useModule(AlertsApiConfigurationModule.register(alertsApiConfiguration))
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    alertsUrl = configurationService.get('alerts-api.baseUri');
    alertsAccount = configurationService.get('alerts-api.account');
    alertsProject = configurationService.get('alerts-api.project');
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('POST add recovery module for a Safe', () => {
    it('Success', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `enable-recovery-alerts-${chain.chainId}-${safe.address}-${addRecoveryModuleDto.moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${addRecoveryModuleDto.moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`
          ? Promise.resolve({ status: 200, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          ...addRecoveryModuleDto,
          signer: signer.address,
        })
        .expect(200);
    });

    it('should prevent requests for modules not on specified Safe', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `enable-recovery-alerts-${chain.chainId}-${safe.address}-${addRecoveryModuleDto.moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${addRecoveryModuleDto.moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`
          ? Promise.resolve({ status: 200, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          ...addRecoveryModuleDto,
          signer: signer.address,
        })
        .expect(403);
    });

    it('should prevent requests older than 5 minutes', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `enable-recovery-alerts-${chain.chainId}-${safe.address}-${addRecoveryModuleDto.moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${addRecoveryModuleDto.moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      jest.advanceTimersByTime(5 * 60 * 1000);

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          ...addRecoveryModuleDto,
          signer: signer.address,
        })
        .expect(403);
    });

    it('should prevent non-Safe owner requests', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().build(); // Signer is not an owner
      const timestamp = jest.now();
      const message = `enable-recovery-alerts-${chain.chainId}-${safe.address}-${addRecoveryModuleDto.moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${addRecoveryModuleDto.moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          ...addRecoveryModuleDto,
          signer: signer.address,
        })
        .expect(403);
    });

    it('should get a validation error', async () => {
      const addRecoveryModuleDto = {
        moduleAddress: faker.number.int(), // Invalid address
      };
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `enable-recovery-alerts-${chain.chainId}-${safe.address}-${addRecoveryModuleDto.moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${addRecoveryModuleDto.moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`
          ? Promise.resolve({ status: 200, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          ...addRecoveryModuleDto,
          signer: signer.address,
        })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['moduleAddress'],
          message: 'Expected string, received number',
        });
    });

    it('Should return the alerts provider error message', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `enable-recovery-alerts-${chain.chainId}-${safe.address}-${addRecoveryModuleDto.moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });
      const error = new NetworkResponseError(
        new URL(
          `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`,
        ),
        {
          status: 400,
        } as Response,
        {
          message: 'Malformed body',
          status: 400,
        },
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${addRecoveryModuleDto.moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          ...addRecoveryModuleDto,
          signer: signer.address,
        });
    });

    it('Should fail with An error occurred', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `enable-recovery-alerts-${chain.chainId}-${safe.address}-${addRecoveryModuleDto.moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const error = new NetworkResponseError(
        new URL(
          `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`,
        ),
        {
          status: statusCode,
        } as Response,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${addRecoveryModuleDto.moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          ...addRecoveryModuleDto,
          signer: signer.address,
        });
    });
  });

  describe('DELETE remove recovery module for a Safe', () => {
    it('Success', async () => {
      const moduleAddress = faker.finance.ethereumAddress();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `disable-recovery-alerts-${chain.chainId}-${safe.address}-${moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`
          ? Promise.resolve({ status: 204, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          signer: signer.address,
        })
        .expect(204);
    });

    it('should prevent requests for modules not on specified Safe', async () => {
      const moduleAddress = faker.finance.ethereumAddress();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `disable-recovery-alerts-${chain.chainId}-${safe.address}-${moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`
          ? Promise.resolve({ status: 204, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          signer: signer.address,
        })
        .expect(403);
    });

    it('should prevent requests older than 5 minutes', async () => {
      const moduleAddress = faker.finance.ethereumAddress();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `disable-recovery-alerts-${chain.chainId}-${safe.address}-${moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`
          ? Promise.resolve({ status: 204, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      jest.advanceTimersByTime(5 * 60 * 1000);

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          signer: signer.address,
        })
        .expect(403);
    });

    it('should prevent non-Safe owner requests', async () => {
      const moduleAddress = faker.finance.ethereumAddress();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().build(); // Signer is not an owner
      const timestamp = jest.now();
      const message = `disable-recovery-alerts-${chain.chainId}-${safe.address}-${moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`
          ? Promise.resolve({ status: 204, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          signer: signer.address,
        })
        .expect(403);
    });

    it('Should return the alerts provider error message', async () => {
      const moduleAddress = faker.finance.ethereumAddress();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `disable-recovery-alerts-${chain.chainId}-${safe.address}-${moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });
      const error = new NetworkResponseError(
        new URL(
          `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`,
        ),
        {
          status: 400,
        } as Response,
        {
          message: 'Malformed body',
          status: 400,
        },
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          signer: signer.address,
        })
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const moduleAddress = faker.finance.ethereumAddress();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `disable-recovery-alerts-${chain.chainId}-${safe.address}-${moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const error = new NetworkResponseError(
        new URL(
          `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`,
        ),
        {
          status: statusCode,
        } as Response,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: chain });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: safe });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: { safes: [safe.address] },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send({
          signer: signer.address,
        })
        .expect(statusCode);
    });
  });
});
