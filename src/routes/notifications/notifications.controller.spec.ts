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
      const chains: Chain[] = range(0, 10).map((chainId) =>
        chainBuilder().with('chainId', chainId.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        if (
          chains.some(
            (chain) =>
              url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
          )
        ) {
          return Promise.resolve({ data: sample(chains) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      mockNetworkService.post.mockImplementation((url) => {
        if (
          chains.some(
            (chain) =>
              url ===
              `${chain.transactionService}/api/v1/notifications/devices/`,
          )
        ) {
          return Promise.resolve();
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(200)
        .expect({});
    });

    it('Client errors returned from provider', async () => {
      const chains: Chain[] = range(11, 20).map((chainId) =>
        chainBuilder().with('chainId', chainId.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const targetChain = chains.find(
          (chain) => url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        if (targetChain) {
          return Promise.resolve({ data: targetChain });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      // return a client error for two chains
      const errorChainIds = [chains[1].chainId, chains[2].chainId];
      mockNetworkService.post.mockImplementation((url) => {
        const targetChain = chains.find(
          (chain) =>
            url === `${chain.transactionService}/api/v1/notifications/devices/`,
        );
        if (!targetChain) {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
        return errorChainIds.includes(targetChain?.chainId)
          ? Promise.reject(
              new NetworkResponseError(
                faker.datatype.number({ min: 400, max: 499 }),
              ),
            )
          : Promise.resolve();
      });

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(400)
        .expect({
          statusCode: 400,
          message: `Push notification registration failed for chain IDs: ${errorChainIds}`,
          error: 'Bad Request',
        });
    });

    it('Server errors returned from provider', async () => {
      const chains: Chain[] = range(21, 30).map((chainId) =>
        chainBuilder().with('chainId', chainId.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const targetChain = chains.find(
          (chain) => url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        if (targetChain) {
          return Promise.resolve({ data: targetChain });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      // return a server error for two chains
      const errorChainIds = [chains[3].chainId, chains[5].chainId];
      mockNetworkService.post.mockImplementation((url) => {
        const targetChain = chains.find(
          (chain) =>
            url === `${chain.transactionService}/api/v1/notifications/devices/`,
        );
        if (!targetChain) {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
        return errorChainIds.includes(targetChain?.chainId)
          ? Promise.reject(
              new NetworkResponseError(
                faker.datatype.number({ min: 500, max: 599 }),
              ),
            )
          : Promise.resolve();
      });

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(500)
        .expect({
          statusCode: 500,
          message: `Push notification registration failed for chain IDs: ${errorChainIds}`,
          error: 'Internal Server Error',
        });
    });

    it('Both client and server errors returned from provider', async () => {
      const chains: Chain[] = range(31, 40).map((chainId) =>
        chainBuilder().with('chainId', chainId.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const targetChain = chains.find(
          (chain) => url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        if (targetChain) {
          return Promise.resolve({ data: targetChain });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      // return a server and client error for two chains each
      const serverErrorChainIds = [chains[3].chainId, chains[4].chainId];
      const clientErrorChainIds = [chains[6].chainId, chains[7].chainId];
      mockNetworkService.post.mockImplementation((url) => {
        const targetChain = chains.find(
          (chain) =>
            url === `${chain.transactionService}/api/v1/notifications/devices/`,
        );
        if (!targetChain) {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
        const serverError = new NetworkResponseError(
          faker.datatype.number({ min: 500, max: 599 }),
        );
        const clientError = new NetworkResponseError(
          faker.datatype.number({ min: 400, max: 499 }),
        );
        if (serverErrorChainIds.includes(targetChain?.chainId)) {
          return Promise.reject(serverError);
        }
        if (clientErrorChainIds.includes(targetChain?.chainId)) {
          return Promise.reject(clientError);
        }
        return Promise.resolve();
      });

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(500)
        .expect({
          statusCode: 500,
          message: `Push notification registration failed for chain IDs: ${[
            ...serverErrorChainIds,
            ...clientErrorChainIds,
          ]}`,
          error: 'Internal Server Error',
        });
    });

    it('No status code errors returned from provider', async () => {
      const chains: Chain[] = range(41, 50).map((chainId) =>
        chainBuilder().with('chainId', chainId.toString()).build(),
      );
      const safeRegistrations: SafeRegistration[] = chains.map((chain) =>
        safeRegistrationBuilder().with('chain_id', chain.chainId).build(),
      );
      const registerDeviceDto = registerDeviceDtoBuilder()
        .with('safeRegistration', safeRegistrations)
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        const targetChain = chains.find(
          (chain) => url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        if (targetChain) {
          return Promise.resolve({ data: targetChain });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      // return a server error for two chains
      const errorChainIds = [chains[3].chainId, chains[4].chainId];
      mockNetworkService.post.mockImplementation((url) => {
        const targetChain = chains.find(
          (chain) =>
            url === `${chain.transactionService}/api/v1/notifications/devices/`,
        );
        if (!targetChain) {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
        if (errorChainIds.includes(targetChain?.chainId)) {
          return Promise.reject(new Error());
        }
        return Promise.resolve();
      });

      await request(app.getHttpServer())
        .post('/register/notifications')
        .send(registerDeviceDto)
        .expect(500)
        .expect({
          statusCode: 500,
          message: `Push notification registration failed for chain IDs: ${errorChainIds}`,
          error: 'Internal Server Error',
        });
    });
  });
});
