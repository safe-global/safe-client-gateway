// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { NetworkResponseError } from '#/datasources/network/entities/network.error.entity';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import { contractBuilder } from '#/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '#/modules/safe/domain/entities/__tests__/module-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import { erc20TokenBuilder } from '#/modules/tokens/domain/__tests__/token.builder';
import { rawify } from '#/validation/entities/raw.entity';

describe('List module transactions by Safe - Transactions Controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let safeDecoderUrl: string;
  let networkService: MockedObject<INetworkService>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    safeDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
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

  it('Looks an address up once when the transactions of a page share it', async () => {
    const chain = chainBuilder().build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const module = contractBuilder().build();
    const recipient = erc20TokenBuilder().build();
    const moduleTransactions = faker.helpers.multiple(
      () =>
        moduleTransactionBuilder()
          .with('safe', safeAddress)
          .with('module', module.address)
          .with('to', recipient.address)
          .with('data', null)
          .with('operation', Operation.CALL)
          .with('value', faker.string.numeric({ exclude: '0' }))
          .build(),
      { count: { min: 2, max: 5 } },
    );
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getModuleTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/module-transactions/`;
    const getTokenUrl = `${chain.transactionService}/api/v1/tokens/${recipient.address}`;
    const getContractUrl = `${safeDecoderUrl}/api/v1/contracts/${module.address}`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getModuleTransactionsUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', moduleTransactions.map(moduleTransactionToJson))
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getTokenUrl) {
        return Promise.resolve({ data: rawify(recipient), status: 200 });
      }
      if (url === getContractUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder().with('count', 1).with('results', [module]).build(),
          ),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safeAddress}/module-transactions`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toEqual(
          moduleTransactions.map(() =>
            expect.objectContaining({
              transaction: expect.objectContaining({
                txInfo: expect.objectContaining({
                  recipient: {
                    value: recipient.address,
                    name: recipient.name,
                    logoUri: recipient.logoUri,
                  },
                }),
                executionInfo: {
                  type: 'MODULE',
                  address: {
                    value: module.address,
                    name: module.displayName,
                    logoUri: module.logoUrl,
                  },
                },
              }),
            }),
          ),
        );
      });

    expect(networkService.get).toHaveBeenCalledTimes(4);
    expect(networkService.get).toHaveBeenCalledWith(
      expect.objectContaining({ url: getTokenUrl }),
    );
    expect(networkService.get).toHaveBeenCalledWith(
      expect.objectContaining({ url: getContractUrl }),
    );
  });
});
