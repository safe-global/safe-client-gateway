import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { range, sample } from 'lodash';
import * as request from 'supertest';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import { TestCacheModule } from '../../datasources/cache/__tests__/test.cache.module';
import { NetworkResponseError } from '../../datasources/network/entities/network.error.entity';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../domain.module';
import { Chain } from '../../domain/chains/entities/chain.entity';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { DataSourceErrorFilter } from '../common/filters/data-source-error.filter';
import { SafeRegistration } from './entities/safe-registration.entity';
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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        NotificationsModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new DataSourceErrorFilter());

    await app.init();
  });

  describe('POST /register/notifications', () => {
    it('Success', async () => {
      const chains: Chain[] = range(4).map((idx) =>
        chainBuilder().with('chainId', idx.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrlPattern = `${safeConfigUrl}/api/v1/chains/`;
        if (url.includes(getChainUrlPattern)) {
          return Promise.resolve({ data: sample(chains) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      mockNetworkService.post.mockImplementation(() => Promise.resolve());

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(200);
    });

    it('Client errors returned from provider', async () => {
      const chains: Chain[] = range(4).map((idx) =>
        chainBuilder().with('chainId', idx.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrlPattern = `${safeConfigUrl}/api/v1/chains/`;
        if (url.includes(getChainUrlPattern)) {
          return Promise.resolve({ data: sample(chains) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      // return a client error for just one provider
      const error = new NetworkResponseError(
        faker.datatype.number({ min: 400, max: 499 }),
      );
      mockNetworkService.post
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementation(() => Promise.resolve());

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(400);
    });

    it('Server errors returned from provider', async () => {
      const chains: Chain[] = range(4).map((idx) =>
        chainBuilder().with('chainId', idx.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrlPattern = `${safeConfigUrl}/api/v1/chains/`;
        if (url.includes(getChainUrlPattern)) {
          return Promise.resolve({ data: sample(chains) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      // return a server error for just one provider
      const error = new NetworkResponseError(
        faker.datatype.number({ min: 500, max: 599 }),
      );
      mockNetworkService.post
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementation(() => Promise.resolve());

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(500);
    });

    it('Both client and server errors returned from provider', async () => {
      const chains: Chain[] = range(4).map((idx) =>
        chainBuilder().with('chainId', idx.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrlPattern = `${safeConfigUrl}/api/v1/chains/`;
        if (url.includes(getChainUrlPattern)) {
          return Promise.resolve({ data: sample(chains) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      // return a client error for one provider, and a server error for another
      const clientError = new NetworkResponseError(
        faker.datatype.number({ min: 400, max: 499 }),
      );
      const serverError = new NetworkResponseError(
        faker.datatype.number({ min: 500, max: 599 }),
      );
      mockNetworkService.post
        .mockImplementationOnce(() => Promise.reject(clientError))
        .mockImplementationOnce(() => Promise.reject(serverError))
        .mockImplementation(() => Promise.resolve());

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(500);
    });

    it('No status code errors returned from provider', async () => {
      const chains: Chain[] = range(4).map((idx) =>
        chainBuilder().with('chainId', idx.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrlPattern = `${safeConfigUrl}/api/v1/chains/`;
        if (url.includes(getChainUrlPattern)) {
          return Promise.resolve({ data: sample(chains) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      // return generic errors for two providers
      mockNetworkService.post
        .mockImplementationOnce(() => Promise.reject(new Error()))
        .mockImplementationOnce(() => Promise.reject(new Error()))
        .mockImplementation(() => Promise.resolve());

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(500);
    });

    it('Other errors returned from provider', async () => {
      const chains: Chain[] = range(4).map((idx) =>
        chainBuilder().with('chainId', idx.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const getChainUrlPattern = `${safeConfigUrl}/api/v1/chains/`;
        if (url.includes(getChainUrlPattern)) {
          return Promise.resolve({ data: sample(chains) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      // return redirection and generic errors for two providers
      const redirection = new NetworkResponseError(
        faker.datatype.number({ min: 300, max: 399 }),
      );
      mockNetworkService.post
        .mockImplementationOnce(() => Promise.reject(redirection))
        .mockImplementationOnce(() => Promise.reject(new Error()))
        .mockImplementation(() => Promise.resolve());

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(500);
    });
  });
});
