import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { range } from 'lodash';
import * as request from 'supertest';
import { TestAppProvider } from '../../app.provider';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import { NetworkResponseError } from '../../datasources/network/entities/network.error.entity';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../domain.module';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { ValidationModule } from '../../validation/validation.module';
import { TestLoggingModule } from '../common/logging/__tests__/test.logging.module';
import { registerDeviceDtoBuilder } from './entities/__tests__/register-device.dto.builder';
import { safeRegistrationBuilder } from './entities/__tests__/safe-registration.builder';
import { NotificationsModule } from './notifications.module';

describe('Notifications Controller (Unit)', () => {
  let app: INestApplication;

  const safeConfigUrl = faker.internet.url();

  beforeAll(async () => {
    fakeConfigurationService.set('safeConfig.baseUri', safeConfigUrl);
    fakeConfigurationService.set('exchange.baseUri', faker.internet.url());
    fakeConfigurationService.set(
      'exchange.apiKey',
      faker.random.alphaNumeric(),
    );
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        NotificationsModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestLoggingModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  const buildInputDto = () =>
    registerDeviceDtoBuilder()
      .with(
        'safeRegistration',
        range(4)
          .map((i) => chainBuilder().with('chainId', i.toString()).build())
          .map((chain) =>
            safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
          ),
      )
      .build();

  const rejectForUrl = (url) =>
    Promise.reject(`No matching rule for url: ${url}`);

  describe('POST /register/notifications', () => {
    it('Success', async () => {
      const registerDeviceDto = buildInputDto();
      mockNetworkService.get.mockImplementation((url) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build() })
          : rejectForUrl(url),
      );
      mockNetworkService.post.mockImplementation((url) =>
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
      mockNetworkService.get.mockImplementation((url) => {
        return url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build() })
          : rejectForUrl(url);
      });
      mockNetworkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                faker.datatype.number({ min: 400, max: 499 }),
              ),
            )
          : rejectForUrl(url),
      );
      mockNetworkService.post.mockImplementation((url) =>
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
            message: `Push notification registration failed for chain IDs: ${registerDeviceDto.safeRegistration[0].chain_id}`,
            error: 'Bad Request',
          }),
        );
    });

    it('Server errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      mockNetworkService.get.mockImplementation((url) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build() })
          : rejectForUrl(url),
      );
      mockNetworkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                faker.datatype.number({ min: 500, max: 599 }),
              ),
            )
          : rejectForUrl(url),
      );
      mockNetworkService.post.mockImplementation((url) =>
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
          message: `Push notification registration failed for chain IDs: ${registerDeviceDto.safeRegistration[0].chain_id}`,
          error: 'Internal Server Error',
        });
    });

    it('Both client and server errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      mockNetworkService.get.mockImplementation((url) => {
        return url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build() })
          : rejectForUrl(url);
      });
      mockNetworkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                faker.datatype.number({ min: 400, max: 499 }),
              ),
            )
          : rejectForUrl(url),
      );
      mockNetworkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                faker.datatype.number({ min: 500, max: 599 }),
              ),
            )
          : rejectForUrl(url),
      );
      mockNetworkService.post.mockImplementation((url) =>
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
            registerDeviceDto.safeRegistration[0].chain_id,
            registerDeviceDto.safeRegistration[1].chain_id,
          ]}`,
          error: 'Internal Server Error',
        });
    });

    it('No status code errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      mockNetworkService.get.mockImplementation((url) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build() })
          : rejectForUrl(url),
      );
      mockNetworkService.post.mockImplementationOnce((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve()
          : rejectForUrl(url),
      );
      mockNetworkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );
      mockNetworkService.post.mockImplementation((url) =>
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
          message: `Push notification registration failed for chain IDs: ${registerDeviceDto.safeRegistration[1].chain_id}`,
          error: 'Internal Server Error',
        });
    });
  });

  describe('DELETE /chains/:chainId/notifications/devices/:uuid/safes/:safeAddress', () => {
    it('Success', async () => {
      const uuid = faker.datatype.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      const expectedProviderURL = `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`;
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : rejectForUrl(url),
      );
      mockNetworkService.delete.mockImplementation((url) =>
        url === expectedProviderURL ? Promise.resolve() : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(200)
        .expect({});
      expect(mockNetworkService.delete).toBeCalledTimes(1);
      expect(mockNetworkService.delete).toBeCalledWith(expectedProviderURL);
    });

    it('Failure: Config API fails', async () => {
      const uuid = faker.datatype.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chainId = faker.random.numeric();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chainId}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(503);
      expect(mockNetworkService.delete).toBeCalledTimes(0);
    });

    it('Failure: Transaction API fails', async () => {
      const uuid = faker.datatype.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : rejectForUrl(url),
      );
      mockNetworkService.delete.mockImplementation((url) =>
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
      expect(mockNetworkService.delete).toBeCalledTimes(1);
    });
  });
});
