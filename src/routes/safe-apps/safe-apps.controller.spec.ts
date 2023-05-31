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
    it('Success', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', 'DOMAIN_ALLOWLIST')
              .build(),
          )
          .build(),
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', 'NO_RESTRICTIONS')
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
        .expect(200)
        .expect(({ body }) => {
          expect(body).toBeInstanceOf(Array);
          expect(body[0].accessControl.type).toBe('DOMAIN_ALLOWLIST');
          expect(body[1].accessControl.type).toBe('NO_RESTRICTIONS');
        });
    });

    it('Success with UNKNOWN accessControl', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', faker.random.word())
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
        .expect(200)
        .expect(({ body }) => {
          expect(body).toBeInstanceOf(Array);
          expect(body[0].accessControl.type).toBe('UNKNOWN');
        });
    });

    it('Should get a data source validation error: DOMAIN_ALLOWLIST values are not URIs', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [
        safeAppBuilder().build(),
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', 'DOMAIN_ALLOWLIST')
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
