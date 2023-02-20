import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { omit } from 'lodash';
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
import { pageBuilder } from '../../domain/entities/__tests__/page.builder';
import { GetEstimationDto } from '../../domain/estimations/entities/get-estimation.dto.entity';
import { estimationBuilder } from '../../domain/estimations/entities/__tests__/estimation.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../domain/safe/entities/__tests__/safe.builder';
import { ValidationModule } from '../../validation.module';
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
        ValidationModule,
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Get estimations', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const estimation = estimationBuilder().build();
      const lastTransaction = multisigTransactionBuilder().build();
      mockNetworkService.get.mockImplementation((url) => {
        const chainsUrl = `${safeConfigApiUrl}/api/v1/chains/${chain.chainId}`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
        const multisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
        if (url === chainsUrl) {
          return Promise.resolve({ data: chain });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({ data: safe });
        }
        if (url === multisigTransactionsUrl) {
          return Promise.resolve({
            data: pageBuilder()
              .with('count', 1)
              .with('results', [multisigTransactionToJson(lastTransaction)])
              .build(),
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      mockNetworkService.post.mockImplementation((url) => {
        const estimationsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/estimations/`;
        return url === estimationsUrl
          ? Promise.resolve({ data: estimation })
          : Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .post(
          `/v2/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions/estimations`,
        )
        .send(
          new GetEstimationDto(
            faker.finance.ethereumAddress(),
            faker.datatype.number(),
            faker.datatype.hexadecimal(32),
            0,
          ),
        )
        .expect(200)
        .expect({
          currentNonce: safe.nonce,
          recommendedNonce: Math.max(safe.nonce, lastTransaction.nonce + 1),
          safeTxGas: estimation.safeTxGas,
        });
    });
  });

  it('Should get a validation error', async () => {
    const getEstimationDto = new GetEstimationDto(
      faker.finance.ethereumAddress(),
      faker.datatype.number(),
      faker.datatype.hexadecimal(32),
      1,
    );
    await request(app.getHttpServer())
      .post(
        `/v2/chains/${faker.random.numeric()}/safes/${faker.finance.ethereumAddress()}/multisig-transactions/estimations`,
      )
      .send(omit(getEstimationDto, 'value'))
      .expect(400)
      .expect({ message: 'Validation failed', code: 42, arguments: [] });
  });

  it('should return last transaction nonce plus 1 as recommended nonce', async () => {
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
      const chainsUrl = `${safeConfigApiUrl}/api/v1/chains/${chain.chainId}`;
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
          data: pageBuilder()
            .with('count', 1)
            .with('results', [multisigTransactionToJson(lastTransaction)])
            .build(),
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    mockNetworkService.post.mockImplementation((url) => {
      const estimationsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/estimations/`;
      return url === estimationsUrl
        ? Promise.resolve({ data: estimation })
        : Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .post(
        `/v2/chains/${chain.chainId}/safes/${address}/multisig-transactions/estimations`,
      )
      .send(
        new GetEstimationDto(
          faker.finance.ethereumAddress(),
          faker.datatype.number(),
          faker.datatype.hexadecimal(32),
          0,
        ),
      )
      .expect(200)
      .expect({
        currentNonce: safe.nonce,
        recommendedNonce: lastTransaction.nonce + 1,
        safeTxGas: estimation.safeTxGas,
      });
  });

  it('should return the current safe nonce if there is no last transaction', async () => {
    const address = faker.finance.ethereumAddress();
    const chain = chainBuilder().build();
    const safe = safeBuilder().with('nonce', faker.datatype.number()).build();
    const estimation = estimationBuilder().build();
    mockNetworkService.get.mockImplementation((url) => {
      const chainsUrl = `${safeConfigApiUrl}/api/v1/chains/${chain.chainId}`;
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
          data: pageBuilder().with('count', 0).with('results', []).build(),
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    mockNetworkService.post.mockImplementation((url) => {
      const estimationsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/estimations/`;
      return url === estimationsUrl
        ? Promise.resolve({ data: estimation })
        : Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .post(
        `/v2/chains/${chain.chainId}/safes/${address}/multisig-transactions/estimations`,
      )
      .send(
        new GetEstimationDto(
          faker.finance.ethereumAddress(),
          faker.datatype.number(),
          faker.datatype.hexadecimal(32),
          0,
        ),
      )
      .expect(200)
      .expect({
        currentNonce: safe.nonce,
        recommendedNonce: safe.nonce,
        safeTxGas: estimation.safeTxGas,
      });
  });

  it('should return safe nonce as recommended nonce if it is greater than last transaction nonce', async () => {
    const address = faker.finance.ethereumAddress();
    const chain = chainBuilder().build();
    const safe = safeBuilder().with('nonce', faker.datatype.number()).build();
    const estimation = estimationBuilder().build();
    const lastTransaction = multisigTransactionBuilder()
      .with('nonce', faker.datatype.number({ max: safe.nonce }))
      .build();
    mockNetworkService.get.mockImplementation((url) => {
      const chainsUrl = `${safeConfigApiUrl}/api/v1/chains/${chain.chainId}`;
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
          data: pageBuilder()
            .with('count', 1)
            .with('results', [multisigTransactionToJson(lastTransaction)])
            .build(),
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    mockNetworkService.post.mockImplementation((url) => {
      const estimationsUrl = `${chain.transactionService}/api/v1/safes/${address}/multisig-transactions/estimations/`;
      return url === estimationsUrl
        ? Promise.resolve({ data: estimation })
        : Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .post(
        `/v2/chains/${chain.chainId}/safes/${address}/multisig-transactions/estimations`,
      )
      .send(
        new GetEstimationDto(
          faker.finance.ethereumAddress(),
          faker.datatype.number(),
          faker.datatype.hexadecimal(32),
          0,
        ),
      )
      .expect(200)
      .expect({
        currentNonce: safe.nonce,
        recommendedNonce: safe.nonce,
        safeTxGas: estimation.safeTxGas,
      });
  });
});
