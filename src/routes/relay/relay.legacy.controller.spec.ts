import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { INestApplication } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';

describe('Relay controller', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        relay: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const supportedChainIds = Object.keys(configuration().relay.apiKey);

  describe.each(supportedChainIds)('Chain %s', (chainId) => {
    describe('POST /v1/chains/:chainId/relay', () => {
      it('should return 302 and redirect to the new endpoint', async () => {
        const safeAddress = faker.finance.ethereumAddress();
        const data = faker.string.hexadecimal();

        await request(app.getHttpServer())
          .post(`/v1/relay`)
          .send({
            chainId,
            to: safeAddress,
            data,
          })
          .expect(308)
          .expect((res) => {
            expect(res.get('location')).toBe(`/v1/chains/${chainId}/relay`);
          });
      });
    });
    describe('GET /v1/relay/:chainId/:safeAddress', () => {
      it('should return 302 and redirect to the new endpoint', async () => {
        const safeAddress = faker.finance.ethereumAddress();

        await request(app.getHttpServer())
          .get(`/v1/relay/${chainId}/${safeAddress}`)
          .expect(301)
          .expect((res) => {
            expect(res.get('location')).toBe(
              `/v1/chains/${chainId}/relay/${safeAddress}`,
            );
          });
      });
    });
  });
});
