import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
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
import { EstimationRequest } from '../../domain/estimations/entities/estimation-request.entity';
import { estimationBuilder } from '../../domain/estimations/entities/__tests__/estimation.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../domain/safe/entities/__tests__/safe.builder';
import { DataSourceErrorFilter } from '../common/filters/data-source-error.filter';
import { EstimationsModule } from './estimations.module';

describe('Estimations Controller (Unit)', () => {
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
        EstimationsModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new DataSourceErrorFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Create estimations', () => {
    it('Success', async () => {
      const chainId = faker.random.numeric();
      const address = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const estimation = estimationBuilder().build();
      const lastTransaction = multisigTransactionBuilder().build();
      mockNetworkService.get.mockImplementation((url) => {
        const chainsUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${address}`;
        const multisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/`;
        if (url === chainsUrl) {
          return Promise.resolve({ data: chain });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({ data: safe });
        }
        if (url === multisigTransactionsUrl) {
          return Promise.resolve({
            data: {
              count: 1,
              results: [multisigTransactionToJson(lastTransaction)],
            },
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      mockNetworkService.post.mockImplementation((url) => {
        const estimationsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/estimations`;
        return url === estimationsUrl
          ? Promise.resolve({ data: estimation })
          : Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .post(
          `/chains/${chainId}/safes/${address}/multisig-transactions/estimations`,
        )
        .send(
          new EstimationRequest(
            faker.finance.ethereumAddress(),
            faker.datatype.number(),
            faker.datatype.hexadecimal(32),
            0,
          ),
        )
        .expect(201)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            currentNonce: safe.nonce,
            recommendedNonce: Math.max(safe.nonce, lastTransaction.nonce + 1),
            estimation: expect.objectContaining({
              safeTxGas: estimation.safeTxGas,
            }),
          });
        });
    });
  });

  it('should return last transaction nonce plus 1 as recommended nonce', async () => {
    const chainId = faker.random.numeric();
    const address = faker.finance.ethereumAddress();
    const chain = chainBuilder().build();
    const safe = safeBuilder()
      .with('nonce', faker.datatype.number({ max: 50 }))
      .build();
    const estimation = estimationBuilder().build();
    const lastTransaction = multisigTransactionBuilder()
      .with('nonce', faker.datatype.number({ min: 51 }))
      .build();
    mockNetworkService.get.mockImplementation((url) => {
      const chainsUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${address}`;
      const multisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/`;
      if (url === chainsUrl) {
        return Promise.resolve({ data: chain });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe });
      }
      if (url === multisigTransactionsUrl) {
        return Promise.resolve({
          data: {
            count: 1,
            results: [multisigTransactionToJson(lastTransaction)],
          },
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    mockNetworkService.post.mockImplementation((url) => {
      const estimationsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/estimations`;
      return url === estimationsUrl
        ? Promise.resolve({ data: estimation })
        : Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .post(
        `/chains/${chainId}/safes/${address}/multisig-transactions/estimations`,
      )
      .send(
        new EstimationRequest(
          faker.finance.ethereumAddress(),
          faker.datatype.number(),
          faker.datatype.hexadecimal(32),
          0,
        ),
      )
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          currentNonce: safe.nonce,
          recommendedNonce: lastTransaction.nonce + 1,
          estimation: expect.objectContaining({
            safeTxGas: estimation.safeTxGas,
          }),
        });
      });
  });

  it('should return the current safe nonce if there is no last transaction', async () => {
    const chainId = faker.random.numeric();
    const address = faker.finance.ethereumAddress();
    const chain = chainBuilder().build();
    const safe = safeBuilder().with('nonce', faker.datatype.number()).build();
    const estimation = estimationBuilder().build();
    mockNetworkService.get.mockImplementation((url) => {
      const chainsUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${address}`;
      const multisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/`;
      if (url === chainsUrl) {
        return Promise.resolve({ data: chain });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe });
      }
      if (url === multisigTransactionsUrl) {
        return Promise.resolve({
          data: {
            count: 0,
            results: [],
          },
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    mockNetworkService.post.mockImplementation((url) => {
      const estimationsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/estimations`;
      return url === estimationsUrl
        ? Promise.resolve({ data: estimation })
        : Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .post(
        `/chains/${chainId}/safes/${address}/multisig-transactions/estimations`,
      )
      .send(
        new EstimationRequest(
          faker.finance.ethereumAddress(),
          faker.datatype.number(),
          faker.datatype.hexadecimal(32),
          0,
        ),
      )
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          currentNonce: safe.nonce,
          recommendedNonce: safe.nonce,
          estimation: expect.objectContaining({
            safeTxGas: estimation.safeTxGas,
          }),
        });
      });
  });

  it('should return safe nonce as recommended nonce if it is greater than last transaction nonce', async () => {
    const chainId = faker.random.numeric();
    const address = faker.finance.ethereumAddress();
    const chain = chainBuilder().build();
    const safe = safeBuilder().with('nonce', faker.datatype.number()).build();
    const estimation = estimationBuilder().build();
    const lastTransaction = multisigTransactionBuilder()
      .with('nonce', faker.datatype.number({ max: safe.nonce }))
      .build();
    mockNetworkService.get.mockImplementation((url) => {
      const chainsUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${address}`;
      const multisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/`;
      if (url === chainsUrl) {
        return Promise.resolve({ data: chain });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe });
      }
      if (url === multisigTransactionsUrl) {
        return Promise.resolve({
          data: {
            count: 0,
            results: [multisigTransactionToJson(lastTransaction)],
          },
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    mockNetworkService.post.mockImplementation((url) => {
      const estimationsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/estimations`;
      return url === estimationsUrl
        ? Promise.resolve({ data: estimation })
        : Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .post(
        `/chains/${chainId}/safes/${address}/multisig-transactions/estimations`,
      )
      .send(
        new EstimationRequest(
          faker.finance.ethereumAddress(),
          faker.datatype.number(),
          faker.datatype.hexadecimal(32),
          0,
        ),
      )
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          currentNonce: safe.nonce,
          recommendedNonce: safe.nonce,
          estimation: expect.objectContaining({
            safeTxGas: estimation.safeTxGas,
          }),
        });
      });
  });
});
