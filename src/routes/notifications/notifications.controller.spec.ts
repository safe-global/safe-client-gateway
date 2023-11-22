import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { range } from 'lodash';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AppModule, configurationModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { registerDeviceDtoBuilder } from '@/routes/notifications/entities/__tests__/register-device.dto.builder';
import { safeRegistrationBuilder } from '@/routes/notifications/entities/__tests__/safe-registration.builder';
import { EmailDataSourceModule } from '@/datasources/email/email.datasource.module';
import { TestEmailDatasourceModule } from '@/datasources/email/__tests__/test.email.datasource.module';

describe('Notifications Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;
  let networkService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(EmailDataSourceModule)
      .useModule(TestEmailDatasourceModule)
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

  const buildInputDto = () =>
    registerDeviceDtoBuilder()
      .with(
        'safeRegistrations',
        range(4)
          .map((i) => chainBuilder().with('chainId', i.toString()).build())
          .map((chain) =>
            safeRegistrationBuilder().with('chainId', chain.chainId).build(),
          ),
      )
      .build();

  const rejectForUrl = (url) =>
    Promise.reject(`No matching rule for url: ${url}`);

  describe('POST /register/notifications', () => {
    it('Success', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation((url) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build() })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve()
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
      networkService.get.mockImplementation((url) => {
        return url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build() })
          : rejectForUrl(url);
      });
      networkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                faker.number.int({ min: 400, max: 499 }),
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve()
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
      networkService.get.mockImplementation((url) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build() })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                faker.number.int({ min: 500, max: 599 }),
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve()
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
      networkService.get.mockImplementation((url) => {
        return url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build() })
          : rejectForUrl(url);
      });
      networkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                faker.number.int({ min: 400, max: 499 }),
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                faker.number.int({ min: 500, max: 599 }),
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve()
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
      networkService.get.mockImplementation((url) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build() })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve()
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve()
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
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation((url) =>
        url === expectedProviderURL ? Promise.resolve() : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(200)
        .expect({});
      expect(networkService.delete).toBeCalledTimes(1);
      expect(networkService.delete).toBeCalledWith(expectedProviderURL);
    });

    it('Failure: Config API fails', async () => {
      const uuid = faker.string.uuid();
      const chainId = faker.string.numeric();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chainId}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chainId}/notifications/devices/${uuid}`)
        .expect(503);
      expect(networkService.delete).toBeCalledTimes(0);
    });

    it('Failure: Transaction API fails', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(503);
      expect(networkService.delete).toBeCalledTimes(1);
    });
  });

  describe('DELETE /chains/:chainId/notifications/devices/:uuid/safes/:safeAddress', () => {
    it('Success', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      const expectedProviderURL = `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`;
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation((url) =>
        url === expectedProviderURL ? Promise.resolve() : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(200)
        .expect({});
      expect(networkService.delete).toBeCalledTimes(1);
      expect(networkService.delete).toBeCalledWith(expectedProviderURL);
    });

    it('Failure: Config API fails', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chainId}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(503);
      expect(networkService.delete).toBeCalledTimes(0);
    });

    it('Failure: Transaction API fails', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation((url) =>
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
      expect(networkService.delete).toBeCalledTimes(1);
    });
  });
});
