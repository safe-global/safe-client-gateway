import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../../../app.provider';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../../../config/__tests__/test.configuration.module';
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
import { addConfirmationDtoBuilder } from '../entities/add-confirmation.dto.builder';

describe('Add transaction confirmations - Transactions Controller (Unit)', () => {
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
        TransactionsModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestLoggingModule,
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

  it('should throw a validation error', async () => {
    await request(app.getHttpServer())
      .post(
        `/v1/chains/${faker.random.numeric()}/transactions/${faker.datatype.hexadecimal()}/confirmations`,
      )
      .send({ signedSafeTxHash: 1 });
  });

  it('should create a confirmation and return the updated transaction', async () => {
    const chain = chainBuilder().build();
    const safeTxHash = faker.datatype.hexadecimal(32);
    const addConfirmationDto = addConfirmationDtoBuilder().build();
    const safeApps = [safeAppBuilder().build()];
    const contract = contractBuilder().build();
    const transaction = multisigToJson(
      multisigTransactionBuilder().build(),
    ) as MultisigTransaction;
    const safe = safeBuilder().with('address', transaction.safe).build();
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${safeTxHash}/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
      const getSafeAppsUrl = `${safeConfigApiUrl}/api/v1/safe-apps/`;
      const getContractUrl = `${chain.transactionService}/api/v1/contracts/${transaction.to}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain });
        case getMultisigTransactionUrl:
          return Promise.resolve({ data: transaction });
        case getSafeUrl:
          return Promise.resolve({ data: safe });
        case getSafeAppsUrl:
          return Promise.resolve({ data: safeApps });
        case getContractUrl:
          return Promise.resolve({ data: contract });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    mockNetworkService.post.mockImplementation((url) => {
      const postConfirmationUrl = `${chain.transactionService}/api/v1/multisig-transactions/${safeTxHash}/confirmations`;
      switch (url) {
        case postConfirmationUrl:
          return Promise.resolve();
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/transactions/${safeTxHash}/confirmations`,
      )
      .send(addConfirmationDto)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual(
          expect.objectContaining({
            id: `multisig_${transaction.safe}_${transaction.safeTxHash}`,
            timestamp: expect.any(Number),
            txStatus: expect.any(String),
            txInfo: expect.any(Object),
            executionInfo: expect.objectContaining({
              type: 'MULTISIG',
              nonce: transaction.nonce,
            }),
            safeAppInfo: expect.any(Object),
          }),
        ),
      );
  });
});
