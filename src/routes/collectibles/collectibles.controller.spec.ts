import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { collectibleBuilder } from '@/domain/collectibles/entities/__tests__/collectible.builder';
import type { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import {
  limitAndOffsetUrlFactory,
  pageBuilder,
} from '@/domain/entities/__tests__/page.builder';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import type { Server } from 'net';
import { getAddress } from 'viem';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';

describe('Collectibles Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        counterfactualBalances: false,
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
    });

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

  describe('GET /v2/collectibles', () => {
    it('is successful', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const pageLimit = 1;
      const safeResponse = safeBuilder().build();
      const collectiblesResponse = pageBuilder<Collectible>()
        .with('next', limitAndOffsetUrlFactory(pageLimit, 0))
        .with('previous', limitAndOffsetUrlFactory(pageLimit, 0))
        .with('results', [
          collectibleBuilder().build(),
          collectibleBuilder().build(),
          collectibleBuilder().build(),
        ])
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          case `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({ data: rawify(safeResponse), status: 200 });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.resolve({
              data: rawify(collectiblesResponse),
              status: 200,
            });
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
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const limit = 10;
      const offset = 20;
      const safeResponse = safeBuilder().build();
      const collectiblesResponse = pageBuilder<Collectible>()
        .with('next', null)
        .with('previous', null)
        .with('results', [
          collectibleBuilder().build(),
          collectibleBuilder().build(),
          collectibleBuilder().build(),
        ])
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          case `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({ data: rawify(safeResponse), status: 200 });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.resolve({
              data: rawify(collectiblesResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${chainId}/safes/${safeAddress}/collectibles/?cursor=limit%3D${limit}%26offset%3D${offset}`,
        )
        .expect(200);

      expect(networkService.get.mock.calls[1][0].networkRequest).toStrictEqual({
        params: {
          limit: 10,
          offset: 20,
          exclude_spam: true,
          trusted: false,
        },
      });
    });

    it('excludeSpam and trusted params are forwarded to tx service', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const excludeSpam = true;
      const trusted = true;
      const safeResponse = safeBuilder().build();
      const collectiblesResponse = pageBuilder<Collectible>()
        .with('next', null)
        .with('previous', null)
        .with('results', [
          collectibleBuilder().build(),
          collectibleBuilder().build(),
          collectibleBuilder().build(),
        ])
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          case `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({ data: rawify(safeResponse), status: 200 });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.resolve({
              data: rawify(collectiblesResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${chainId}/safes/${safeAddress}/collectibles/?exclude_spam=${excludeSpam}&trusted=${trusted}`,
        )
        .expect(200);

      expect(networkService.get.mock.calls[1][0].networkRequest).toStrictEqual({
        params: {
          limit: PaginationData.DEFAULT_LIMIT,
          offset: PaginationData.DEFAULT_OFFSET,
          exclude_spam: excludeSpam,
          trusted,
        },
      });
    });

    it('tx service collectibles returns 400', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const safeResponse = safeBuilder().build();
      const transactionServiceUrl = `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`;
      const transactionServiceError = new NetworkResponseError(
        new URL(transactionServiceUrl),
        { status: 400 } as Response,
        {
          message: 'some collectibles error',
        },
      );
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          case `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({ data: rawify(safeResponse), status: 200 });
          case transactionServiceUrl:
            return Promise.reject(transactionServiceError);
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chainId}/safes/${safeAddress}/collectibles`)
        .expect(transactionServiceError.response.status)
        .expect({
          code: transactionServiceError.response.status,
          message: (transactionServiceError.data as { message: string })
            .message,
        });
    });

    it('tx service collectibles does not return a response', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const safeResponse = safeBuilder().build();
      const transactionServiceUrl = `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`;
      const transactionServiceError = new NetworkRequestError(
        new URL(transactionServiceUrl),
      );
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          case `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({ data: rawify(safeResponse), status: 200 });
          case transactionServiceUrl:
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
