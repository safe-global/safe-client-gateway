import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/module-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';

describe('List module transactions by Safe - Transactions Controller', () => {
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

  afterEach(async () => {
    await app.close();
  });

  it('Failure: Config API fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const error = new NetworkResponseError(
      new URL(`${safeConfigUrl}/api/v1/chains/${chainId}`),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(networkService.get).toHaveBeenCalledTimes(1);
    expect(networkService.get).toHaveBeenCalledWith({
      url: `${safeConfigUrl}/api/v1/chains/${chainId}`,
    });
  });

  it('Failure: Transaction API fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    networkService.get.mockResolvedValueOnce({
      data: rawify(chainResponse),
      status: 200,
    });
    const error = new NetworkResponseError(
      new URL(
        `${chainResponse.transactionService}/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`,
      ),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(networkService.get).toHaveBeenCalledTimes(2);
    expect(networkService.get).toHaveBeenCalledWith({
      url: `${safeConfigUrl}/api/v1/chains/${chainId}`,
    });
  });

  it('Failure: data page validation fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const page = pageBuilder().build();
    const chain = chainBuilder().with('chainId', chainId).build();
    networkService.get.mockResolvedValueOnce({
      data: rawify(chain),
      status: 200,
    });
    networkService.get.mockResolvedValueOnce({
      data: rawify({ ...page, count: faker.word.words() }),
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(502)
      .expect({ statusCode: 502, message: 'Bad gateway' });
  });

  it('Get module transaction should return 404', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    networkService.get.mockResolvedValueOnce({
      data: rawify(chainResponse),
      status: 200,
    });
    const error = new NetworkResponseError(
      new URL(
        `${chainResponse.transactionService}/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`,
      ),
      { status: 404 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(404)
      .expect({
        message: 'An error occurred',
        code: 404,
      });

    expect(networkService.get).toHaveBeenCalledTimes(2);
    expect(networkService.get).toHaveBeenCalledWith({
      url: `${safeConfigUrl}/api/v1/chains/${chainId}`,
    });
  });

  it('Get module transaction successfully', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    const moduleTransaction1 = moduleTransactionBuilder().build();
    const moduleTransaction2 = moduleTransactionBuilder().build();
    const moduleTransaction = {
      count: 2,
      next: null,
      previous: null,
      results: [
        moduleTransactionToJson(moduleTransaction1),
        moduleTransactionToJson(moduleTransaction2),
      ],
    };

    const safe = safeBuilder().build();
    networkService.get.mockResolvedValueOnce({
      data: rawify(chainResponse),
      status: 200,
    });
    networkService.get.mockResolvedValueOnce({
      data: rawify(moduleTransaction),
      status: 200,
    });
    networkService.get.mockResolvedValueOnce({
      data: rawify(safe),
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          count: 2,
          next: null,
          previous: null,
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `module_${moduleTransaction1.safe}_${moduleTransaction1.moduleTransactionId}`,
                txHash: moduleTransaction1.transactionHash,
                safeAppInfo: null,
                note: null,
                timestamp: moduleTransaction1.executionDate.getTime(),
                txStatus: expect.any(String),
                txInfo: {
                  type: expect.any(String),
                },
                executionInfo: {
                  type: 'MODULE',
                  address: { value: moduleTransaction1.module },
                },
              },
              conflictType: 'None',
            },
            {
              type: 'TRANSACTION',
              transaction: {
                id: `module_${moduleTransaction2.safe}_${moduleTransaction2.moduleTransactionId}`,
                txHash: moduleTransaction2.transactionHash,
                safeAppInfo: null,
                note: null,
                timestamp: moduleTransaction2.executionDate.getTime(),
                txStatus: expect.any(String),
                txInfo: {
                  type: expect.any(String),
                },
                executionInfo: {
                  type: 'MODULE',
                  address: { value: moduleTransaction2.module },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });
});
