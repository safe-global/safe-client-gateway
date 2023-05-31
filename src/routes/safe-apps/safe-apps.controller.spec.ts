import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../domain.module';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { SafeAppAccessControlPolicies } from '../../domain/safe-apps/entities/safe-app-access-control.entity';
import { safeAppAccessControlBuilder } from '../../domain/safe-apps/entities/__tests__/safe-app-access-control.builder';
import { safeAppBuilder } from '../../domain/safe-apps/entities/__tests__/safe-app.builder';
import { TestLoggingModule } from '../../logging/__tests__/test.logging.module';
import { ValidationModule } from '../../validation/validation.module';
import { SafeAppsModule } from './safe-apps.module';

describe('Safe Apps Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigApiUrl: string;

  beforeAll(async () => {
    safeConfigApiUrl = faker.internet.url();
    fakeConfigurationService.set('safeConfig.baseUri', safeConfigApiUrl);
    fakeConfigurationService.set('exchange.baseUri', faker.internet.url());
    fakeConfigurationService.set('exchange.apiKey', faker.datatype.uuid());
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        SafeAppsModule,
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

  afterAll(async () => {
    await app.close();
  });

  describe('Get Safe Apps', () => {
    it('Success with DOMAIN_ALLOWLIST accessControl', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [
        safeAppBuilder().build(),
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
              .build(),
          )
          .build(),
      ];

      mockNetworkService.get.mockImplementation((url) => {
        const getSafeAppsUrl = `${safeConfigApiUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({ data: safeAppsResponse });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safe-apps`)
        .expect(200);
    });

    it('Success with NO_RESTRICTIONS accessControl', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [
        safeAppBuilder().build(),
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', SafeAppAccessControlPolicies.NoRestrictions)
              .with('value', null)
              .build(),
          )
          .build(),
      ];

      mockNetworkService.get.mockImplementation((url) => {
        const getSafeAppsUrl = `${safeConfigApiUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({ data: safeAppsResponse });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safe-apps`)
        .expect(200);
    });

    it('Success with UNKNOWN accessControl', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [
        safeAppBuilder().build(),
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', SafeAppAccessControlPolicies.Unknown)
              .with('value', null)
              .build(),
          )
          .build(),
      ];

      mockNetworkService.get.mockImplementation((url) => {
        const getSafeAppsUrl = `${safeConfigApiUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({ data: safeAppsResponse });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safe-apps`)
        .expect(200);
    });

    it('Should get a data source validation error: DOMAIN_ALLOWLIST values are not URIs', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [
        safeAppBuilder().build(),
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
              .with('value', [
                faker.datatype.hexadecimal(),
                faker.datatype.hexadecimal(),
              ])
              .build(),
          )
          .build(),
      ];

      mockNetworkService.get.mockImplementation((url) => {
        const getSafeAppsUrl = `${safeConfigApiUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({ data: safeAppsResponse });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safe-apps`)
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });
  });
});
