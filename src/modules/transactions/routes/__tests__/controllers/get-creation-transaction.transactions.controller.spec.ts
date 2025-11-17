import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import {
  creationTransactionBuilder,
  toJson as creationTransactionToJson,
} from '@/domain/safe/entities/__tests__/creation-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { rawify } from '@/validation/entities/raw.entity';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import request from 'supertest';

describe('Get creation transaction', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let safeDecoderUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    safeDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return the creation transaction', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const creationTransaction = creationTransactionBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getCreationTransactionUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/creation/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getCreationTransactionUrl:
          return Promise.resolve({
            data: rawify(creationTransactionToJson(creationTransaction)),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${safeDecoderUrl}/api/v1/data-decoder`) {
        return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/creation/`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          ...creationTransaction,
          dataDecoded,
          created: creationTransaction.created.toISOString(),
        });
      });
  });

  it('should forward Transaction Service errors', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getCreationTransactionUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/creation/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getCreationTransactionUrl:
          return Promise.reject(
            new NetworkResponseError(new URL(getCreationTransactionUrl), {
              status: 404,
            } as Response),
          );
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/creation/`,
      )
      .expect(404);
  });

  it('should fail if the Transaction Service fails', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getCreationTransactionUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/creation/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getCreationTransactionUrl:
          return Promise.reject(new Error());
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/creation/`,
      )
      .expect(503);
  });

  it('should fail if the Config Service fails', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const creationTransaction = creationTransactionBuilder().build();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getCreationTransactionUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/creation/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.reject(new Error());
        case getCreationTransactionUrl:
          return Promise.resolve({
            data: rawify(creationTransactionToJson(creationTransaction)),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/creation/`,
      )
      .expect(503);
  });
});
