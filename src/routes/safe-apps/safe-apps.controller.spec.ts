import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { SafeAppAccessControlPolicies } from '@/domain/safe-apps/entities/safe-app-access-control.entity';
import { safeAppAccessControlBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app-access-control.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';

describe('Safe Apps Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

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
      networkService.get.mockImplementation(({ url }) => {
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({
            data: rawify(safeAppsResponse),
            status: 200,
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
            accessControl: {
              type: 'DOMAIN_ALLOWLIST',
              value: (
                safeAppsResponse[0].accessControl as {
                  value: Array<string> | null;
                  type: SafeAppAccessControlPolicies.DomainAllowlist;
                }
              ).value,
            },
            tags: safeAppsResponse[0].tags,
            features: safeAppsResponse[0].features,
            developerWebsite: safeAppsResponse[0].developerWebsite,
            socialProfiles: safeAppsResponse[0].socialProfiles,
            featured: safeAppsResponse[0].featured,
          },
          {
            id: safeAppsResponse[1].id,
            url: safeAppsResponse[1].url,
            name: safeAppsResponse[1].name,
            iconUrl: safeAppsResponse[1].iconUrl,
            description: safeAppsResponse[1].description,
            chainIds: safeAppsResponse[1].chainIds.map((c) => c.toString()),
            provider: safeAppsResponse[1].provider,
            accessControl: {
              type: 'NO_RESTRICTIONS',
              value: null,
            },
            tags: safeAppsResponse[1].tags,
            features: safeAppsResponse[1].features,
            developerWebsite: safeAppsResponse[1].developerWebsite,
            socialProfiles: safeAppsResponse[1].socialProfiles,
            featured: safeAppsResponse[1].featured,
          },
        ]);
    });

    it('Success with UNKNOWN accessControl', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [safeAppBuilder().build()];
      networkService.get.mockImplementation(({ url }) => {
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({
            data: rawify([
              {
                ...safeAppsResponse[0],
                accessControl: {
                  type: 'UNKNOWN',
                  value: null,
                },
              },
            ]),
            status: 200,
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
            accessControl: {
              type: 'UNKNOWN',
              value: null,
            },
            tags: safeAppsResponse[0].tags,
            features: safeAppsResponse[0].features,
            developerWebsite: safeAppsResponse[0].developerWebsite,
            socialProfiles: safeAppsResponse[0].socialProfiles,
            featured: safeAppsResponse[0].featured,
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
                faker.string.hexadecimal(),
                faker.string.hexadecimal(),
              ])
              .build(),
          )
          .build(),
      ];

      networkService.get.mockImplementation(({ url }) => {
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({
            data: rawify(safeAppsResponse),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safe-apps`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });
  });
});
