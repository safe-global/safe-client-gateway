import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../../../app.provider';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../../../domain.module';
import { chainBuilder } from '../../../../domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '../../../../domain/contracts/entities/__tests__/contract.builder';
import { safeAppBuilder } from '../../../../domain/safe-apps/entities/__tests__/safe-app.builder';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import {
  multisigTransactionBuilder,
  toJson as multisigToJson,
} from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '../../../../logging/__tests__/test.logging.module';
import { ValidationModule } from '../../../../validation/validation.module';
import { TransactionsModule } from '../../transactions.module';
import { ConfigurationModule } from '../../../../config/configuration.module';
import configuration from '../../../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../../../config/configuration.service.interface';

describe('List queued transactions by Safe - Transactions Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        TransactionsModule,
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

  it('should get a transactions queue with labels and conflict headers', async () => {
    const chainId = faker.random.numeric();
    const chainResponse = chainBuilder().build();
    const safeAddress = faker.finance.ethereumAddress();
    const safeResponse = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', 1)
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url())
        .with('iconUrl', faker.internet.url())
        .with('name', faker.random.words())
        .build(),
    ];
    const contractResponse = contractBuilder().build();
    const transactions: MultisigTransaction[] = [
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('nonce', 1)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('nonce', 1)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('nonce', 2)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('isExecuted', false)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('nonce', 2)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('isExecuted', false)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('nonce', 3)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('isExecuted', false)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('nonce', 4)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('isExecuted', false)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
    ];

    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: {
            count: 6,
            next: null,
            previous: null,
            results: transactions,
          },
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: safeAppsResponse });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: contractResponse });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/queued`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual({
          count: 10,
          next: null,
          previous: null,
          results: [
            {
              type: 'LABEL',
              label: 'Next',
            },
            {
              type: 'CONFLICT_HEADER',
              nonce: 1,
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[0].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[1].safeTxHash}`,
              }),
              conflictType: 'End',
            },
            {
              type: 'LABEL',
              label: 'Queued',
            },
            {
              type: 'CONFLICT_HEADER',
              nonce: 2,
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[2].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[3].safeTxHash}`,
              }),
              conflictType: 'End',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[4].safeTxHash}`,
              }),
              conflictType: 'None',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[5].safeTxHash}`,
              }),
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('should get a transactions queue with labels and conflict headers for a multi-page queue', async () => {
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const contractResponse = contractBuilder().build();
    const safeResponse = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', 1)
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url())
        .with('iconUrl', faker.internet.url())
        .with('name', faker.random.words())
        .build(),
    ];
    const transactions: MultisigTransaction[] = [
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('nonce', 1)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('nonce', 1)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('nonce', 1)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('isExecuted', false)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('nonce', 1)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('nonce', 2)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('isExecuted', false)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('nonce', 2)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('isExecuted', false)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('nonce', 3)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('isExecuted', false)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
      multisigToJson(
        multisigTransactionBuilder()
          .with('safe', safeAddress)
          .with('nonce', 3)
          .with('safeTxHash', faker.finance.ethereumAddress())
          .with('isExecuted', false)
          .with('dataDecoded', null)
          .build(),
      ) as MultisigTransaction,
    ];
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getMultisigTransactionsUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: {
            count: 20,
            next: `${faker.internet.url()}/?limit=10&offset=50`,
            previous: `${faker.internet.url()}/?limit=10&offset=30`,
            results: transactions,
          },
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: safeAppsResponse });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: contractResponse });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/queued/?cursor=limit%3D10%26offset%3D2`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual({
          count: 10,
          next: expect.stringContaining('?cursor='),
          previous: expect.stringContaining('?cursor='),
          results: [
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[0].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[1].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[2].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[3].safeTxHash}`,
              }),
              conflictType: 'End',
            },
            {
              type: 'LABEL',
              label: 'Queued',
            },
            {
              type: 'CONFLICT_HEADER',
              nonce: 2,
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[4].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[5].safeTxHash}`,
              }),
              conflictType: 'End',
            },
            {
              type: 'CONFLICT_HEADER',
              nonce: 3,
            },
            {
              type: 'TRANSACTION',
              transaction: expect.objectContaining({
                id: `multisig_${safeAddress}_${transactions[6].safeTxHash}`,
              }),
              conflictType: 'HasNext',
            },
          ],
        });
      });
  });
});
