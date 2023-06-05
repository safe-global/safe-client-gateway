import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../../../app.provider';
import { TestCacheModule } from '../../../../datasources/cache/__tests__/test.cache.module';
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
import { proposeTransactionDtoBuilder } from '../../entities/__tests__/propose-transaction.dto.builder';
import { TransactionsModule } from '../../transactions.module';
import { ConfigurationModule } from '../../../../config/configuration.module';
import configuration from '../../../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../../../config/configuration.service.interface';

describe('Propose transaction - Transactions Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;

  beforeEach(async () => {
    jest.clearAllMocks();

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

  it('should throw a validation error', async () => {
    const safeAddress = faker.random.numeric();
    const proposeTransactionDto = proposeTransactionDtoBuilder().build();
    const { safeTxHash } = proposeTransactionDto;
    await request(app.getHttpServer())
      .post(`/v1/chains/${safeAddress}/transactions/${safeTxHash}/propose`)
      .send({ ...proposeTransactionDto, value: 1 })
      .expect(400);
  });

  it('should propose a transaction', async () => {
    const proposeTransactionDto = proposeTransactionDtoBuilder().build();
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().with('address', safeAddress).build();
    const safeApps = [safeAppBuilder().build()];
    const contract = contractBuilder().build();
    const transaction = multisigToJson(
      multisigTransactionBuilder().build(),
    ) as MultisigTransaction;
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
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
      const proposeTransactionUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      switch (url) {
        case proposeTransactionUrl:
          return Promise.resolve({ data: {} });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/transactions/${safeAddress}/propose`)
      .send(proposeTransactionDto)
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
