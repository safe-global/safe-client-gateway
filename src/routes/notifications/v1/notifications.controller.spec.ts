import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { registerDeviceDtoBuilder } from '@/routes/notifications/v1/entities/__tests__/register-device.dto.builder';
import { safeRegistrationBuilder } from '@/routes/notifications/v1/entities/__tests__/safe-registration.builder';
import type { RegisterDeviceDto } from '@/routes/notifications/v1/entities/register-device.dto.entity';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { getAddress } from 'viem';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Notifications Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
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
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  const buildInputDto = (): RegisterDeviceDto =>
    registerDeviceDtoBuilder()
      .with(
        'safeRegistrations',
        faker.helpers.multiple(
          (_, i) => {
            return safeRegistrationBuilder()
              .with('chainId', i.toString())
              .build();
          },
          { count: 4 },
        ),
      )
      .build();

  const rejectForUrl = (url: string): Promise<never> =>
    Promise.reject(`No matching rule for url: ${url}`);

  describe('POST /register/notifications', () => {
    it('Success', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation(({ url }) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({
              data: rawify(chainBuilder().build()),
              status: 200,
            })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation(({ url }) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(200)
        .expect({});
    });

    it('Client errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation(({ url }) => {
        return url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({
              data: rawify(chainBuilder().build()),
              status: 200,
            })
          : rejectForUrl(url);
      });
      networkService.post.mockImplementationOnce(({ url }) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                new URL(`${safeConfigUrl}/api/v1/notifications/devices`),
                {
                  status: faker.number.int({ min: 400, max: 499 }),
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation(({ url }) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(400)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            statusCode: 400,
            message: `Push notification registration failed for chain IDs: ${registerDeviceDto.safeRegistrations[0].chainId}`,
            error: 'Bad Request',
          }),
        );
    });

    it('Server errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation(({ url }) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({
              data: rawify(chainBuilder().build()),
              status: 200,
            })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce(({ url }) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                new URL(`${safeConfigUrl}/api/v1/notifications/devices`),
                {
                  status: faker.number.int({ min: 500, max: 599 }),
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation(({ url }) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(500)
        .expect({
          statusCode: 500,
          message: `Push notification registration failed for chain IDs: ${registerDeviceDto.safeRegistrations[0].chainId}`,
          error: 'Internal Server Error',
        });
    });

    it('Both client and server errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation(({ url }) => {
        return url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({
              data: rawify(chainBuilder().build()),
              status: 200,
            })
          : rejectForUrl(url);
      });
      networkService.post.mockImplementationOnce(({ url }) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                new URL(`${safeConfigUrl}/api/v1/notifications/devices`),
                {
                  status: faker.number.int({ min: 400, max: 499 }),
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce(({ url }) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                new URL(`${safeConfigUrl}/api/v1/notifications/devices`),
                {
                  status: faker.number.int({ min: 500, max: 599 }),
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation(({ url }) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(500)
        .expect({
          statusCode: 500,
          message: `Push notification registration failed for chain IDs: ${[
            registerDeviceDto.safeRegistrations[0].chainId,
            registerDeviceDto.safeRegistrations[1].chainId,
          ]}`,
          error: 'Internal Server Error',
        });
    });

    it('No status code errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation(({ url }) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({
              data: rawify(chainBuilder().build()),
              status: 200,
            })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce(({ url }) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce(({ url }) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation(({ url }) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(500)
        .expect({
          statusCode: 500,
          message: `Push notification registration failed for chain IDs: ${registerDeviceDto.safeRegistrations[1].chainId}`,
          error: 'Internal Server Error',
        });
    });
  });

  describe('DELETE /chains/:chainId/notifications/devices/:uuid', () => {
    it('Success', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();
      const expectedProviderURL = `${chain.transactionService}/api/v1/notifications/devices/${uuid}`;
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url === expectedProviderURL
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(200)
        .expect({});
      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: expectedProviderURL,
      });
    });

    it('Failure: Config API fails', async () => {
      const uuid = faker.string.uuid();
      const chainId = faker.string.numeric();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chainId}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chainId}/notifications/devices/${uuid}`)
        .expect(503);
      expect(networkService.delete).toHaveBeenCalledTimes(0);
    });

    it('Failure: Transaction API fails', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(503);
      expect(networkService.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /chains/:chainId/notifications/devices/:uuid/safes/:safeAddress', () => {
    it('Success', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      // ValidationPipe checksums safeAddress param
      const expectedProviderURL = `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${getAddress(safeAddress)}`;
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url === expectedProviderURL
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(200)
        .expect({});
      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: expectedProviderURL,
      });
    });

    it('Failure: Config API fails', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chainId}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(503);
      expect(networkService.delete).toHaveBeenCalledTimes(0);
    });

    it('Failure: Transaction API fails', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(503);
      expect(networkService.delete).toHaveBeenCalledTimes(1);
    });
  });
});
