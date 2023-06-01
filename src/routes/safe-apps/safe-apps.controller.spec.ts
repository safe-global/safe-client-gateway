import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../app.provider';
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
import { ConfigurationModule } from '../../config/configuration.module';
import configuration from '../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../config/configuration.service.interface';

describe('Safe Apps Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;

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
        ConfigurationModule.register(configuration),
        TestLoggingModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');

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
              .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
              .build(),
          )
          .build(),
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', SafeAppAccessControlPolicies.NoRestrictions)
              .build(),
          )
          .build(),
      ];
      mockNetworkService.get.mockImplementation((url) => {
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({ data: safeAppsResponse });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safe-apps`)
        .expect(200)
        .expect([
          {
            id: safeAppsResponse[0].id,
            url: safeAppsResponse[0].url,
            name: safeAppsResponse[0].name,
            iconUrl: safeAppsResponse[0].iconUrl,
            description: safeAppsResponse[0].description,
            chainIds: safeAppsResponse[0].chainIds.map((c) => c.toString()),
            provider: safeAppsResponse[0].provider,
            accessControl: {
              type: 'DOMAIN_ALLOWLIST',
              value: safeAppsResponse[0].accessControl.value,
            },
            tags: safeAppsResponse[0].tags,
            features: safeAppsResponse[0].features,
            developerWebsite: safeAppsResponse[0].developerWebsite,
            socialProfiles: safeAppsResponse[0].socialProfiles,
          },
          {
            id: safeAppsResponse[1].id,
            url: safeAppsResponse[1].url,
            name: safeAppsResponse[1].name,
            iconUrl: safeAppsResponse[1].iconUrl,
            description: safeAppsResponse[1].description,
            chainIds: safeAppsResponse[1].chainIds.map((c) => c.toString()),
            provider: safeAppsResponse[1].provider,
            accessControl: { type: 'NO_RESTRICTIONS' },
            tags: safeAppsResponse[1].tags,
            features: safeAppsResponse[1].features,
            developerWebsite: safeAppsResponse[1].developerWebsite,
            socialProfiles: safeAppsResponse[1].socialProfiles,
          },
        ]);
    });

    it('Success with UNKNOWN accessControl', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [safeAppBuilder().build()];
      mockNetworkService.get.mockImplementation((url) => {
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({
            data: [
              {
                ...safeAppsResponse[0],
                accessControl: {
                  type: faker.random.word(),
                  value: safeAppsResponse[0].accessControl.value,
                },
              },
            ],
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safe-apps`)
        .expect(200)
        .expect([
          {
            id: safeAppsResponse[0].id,
            url: safeAppsResponse[0].url,
            name: safeAppsResponse[0].name,
            iconUrl: safeAppsResponse[0].iconUrl,
            description: safeAppsResponse[0].description,
            chainIds: safeAppsResponse[0].chainIds.map((c) => c.toString()),
            provider: safeAppsResponse[0].provider,
            accessControl: { type: 'UNKNOWN' },
            tags: safeAppsResponse[0].tags,
            features: safeAppsResponse[0].features,
            developerWebsite: safeAppsResponse[0].developerWebsite,
            socialProfiles: safeAppsResponse[0].socialProfiles,
          },
        ]);
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
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
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
