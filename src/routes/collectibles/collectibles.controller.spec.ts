import { TestCacheModule } from '../../datasources/cache/__tests__/test.cache.module';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainModule } from '../../domain.module';
import { TestNetworkModule } from '../../datasources/network/__tests__/test.network.module';
import { INestApplication } from '@nestjs/common';
import { CollectiblesModule } from './collectibles.module';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { Collectible } from '../../domain/collectibles/entities/collectible.entity';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '../../datasources/network/entities/network.error.entity';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { collectibleBuilder } from '../../domain/collectibles/entities/__tests__/collectible.builder';
import {
  limitAndOffsetUrlFactory,
  pageBuilder,
} from '../../domain/entities/__tests__/page.builder';
import { PaginationData } from '../common/pagination/pagination.data';
import { TestAppProvider } from '../../__tests__/test-app.provider';
import { ValidationModule } from '../../validation/validation.module';
import { TestLoggingModule } from '../../logging/__tests__/test.logging.module';
import { ConfigurationModule } from '../../config/configuration.module';
import configuration from '../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { NetworkService } from '../../datasources/network/network.service.interface';

describe('Collectibles Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;
  let networkService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        CollectiblesModule,
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
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v2/collectibles', () => {
    it('is successful', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const pageLimit = 1;
      const collectiblesResponse = pageBuilder<Collectible>()
        .with('next', limitAndOffsetUrlFactory(pageLimit, 0))
        .with('previous', limitAndOffsetUrlFactory(pageLimit, 0))
        .with('results', [
          collectibleBuilder().build(),
          collectibleBuilder().build(),
          collectibleBuilder().build(),
        ])
        .build();

      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({ data: chainResponse });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.resolve({ data: collectiblesResponse });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chainId}/safes/${safeAddress}/collectibles`)
        .expect(200)
        .expect((response) => {
          expect(response.body.count).toBe(collectiblesResponse.count);
          expect(response.body.results).toStrictEqual([
            collectiblesResponse.results[0],
            collectiblesResponse.results[1],
            collectiblesResponse.results[2],
          ]);
          expect(response.body.next).toContain(`limit%3D${pageLimit}`);
          expect(response.body.next).toContain(`limit%3D${pageLimit}`);
        });
    });

    it('pagination data is forwarded to tx service', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const limit = 10;
      const offset = 20;

      const collectiblesResponse = pageBuilder<Collectible>()
        .with('next', null)
        .with('previous', null)
        .with('results', [
          collectibleBuilder().build(),
          collectibleBuilder().build(),
          collectibleBuilder().build(),
        ])
        .build();

      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({ data: chainResponse });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.resolve({ data: collectiblesResponse });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${chainId}/safes/${safeAddress}/collectibles/?cursor=limit%3D${limit}%26offset%3D${offset}`,
        )
        .expect(200);

      expect(networkService.get.mock.calls[1][1]).toStrictEqual({
        params: {
          limit: 10,
          offset: 20,
          exclude_spam: undefined,
          trusted: undefined,
        },
      });
    });

    it('excludeSpam and trusted params are forwarded to tx service', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const excludeSpam = true;
      const trusted = true;

      const collectiblesResponse = pageBuilder<Collectible>()
        .with('next', null)
        .with('previous', null)
        .with('results', [
          collectibleBuilder().build(),
          collectibleBuilder().build(),
          collectibleBuilder().build(),
        ])
        .build();

      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({ data: chainResponse });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.resolve({ data: collectiblesResponse });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${chainId}/safes/${safeAddress}/collectibles/?exclude_spam=${excludeSpam}&trusted=${trusted}`,
        )
        .expect(200);

      expect(networkService.get.mock.calls[1][1]).toStrictEqual({
        params: {
          limit: PaginationData.DEFAULT_LIMIT,
          offset: PaginationData.DEFAULT_OFFSET,
          exclude_spam: excludeSpam.toString(),
          trusted: trusted.toString(),
        },
      });
    });

    it('tx service collectibles returns 400', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const transactionServiceError = new NetworkResponseError(400, {
        message: 'some collectibles error',
      });
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({ data: chainResponse });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.reject(transactionServiceError);
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chainId}/safes/${safeAddress}/collectibles`)
        .expect(transactionServiceError.status)
        .expect({
          code: transactionServiceError.status,
          message: transactionServiceError.data.message,
        });
    });

    it('tx service collectibles does not return a response', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const transactionServiceError = new NetworkRequestError({});
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({ data: chainResponse });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.reject(transactionServiceError);
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chainId}/safes/${safeAddress}/collectibles`)
        .expect(503)
        .expect({
          code: 503,
          message: 'Service unavailable',
        });
    });
  });
});
