import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../../../__tests__/test-app.provider';
import { TestCacheModule } from '../../../../datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '../../../../datasources/network/__tests__/test.network.module';
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
import { ConfigurationModule } from '../../../../config/configuration.module';
import configuration from '../../../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../../../config/configuration.service.interface';
import { tokenBuilder } from '../../../../domain/tokens/__tests__/token.builder';
import { pageBuilder } from '../../../../domain/entities/__tests__/page.builder';
import { NetworkService } from '../../../../datasources/network/network.service.interface';

describe('Add transaction confirmations - Transactions Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;
  let networkService;

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
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should throw a validation error', async () => {
    await request(app.getHttpServer())
      .post(
        `/v1/chains/${faker.string.numeric()}/transactions/${faker.string.hexadecimal()}/confirmations`,
      )
      .send({ signedSafeTxHash: 1 });
  });

  it('should create a confirmation and return the updated transaction', async () => {
    const chain = chainBuilder().build();
    const safeTxHash = faker.string.hexadecimal({ length: 32 });
    const addConfirmationDto = addConfirmationDtoBuilder().build();
    const safeApps = [safeAppBuilder().build()];
    const contract = contractBuilder().build();
    const transaction = multisigToJson(
      multisigTransactionBuilder().build(),
    ) as MultisigTransaction;
    const safe = safeBuilder().with('address', transaction.safe).build();
    const gasToken = tokenBuilder().build();
    const token = tokenBuilder().build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const rejectionTxsPage = pageBuilder().with('results', []).build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${safeTxHash}/`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${transaction.to}`;
      const getToTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.to}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain });
        case getMultisigTransactionUrl:
          return Promise.resolve({ data: transaction });
        case getMultisigTransactionsUrl:
          return Promise.resolve({ data: rejectionTxsPage });
        case getSafeUrl:
          return Promise.resolve({ data: safe });
        case getSafeAppsUrl:
          return Promise.resolve({ data: safeApps });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: gasToken });
        case getToContractUrl:
          return Promise.resolve({ data: contract });
        case getToTokenUrl:
          return Promise.resolve({ data: token });
        case getSafeAppsUrl:
          return Promise.resolve({ data: safeAppsResponse });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    networkService.post.mockImplementation((url) => {
      const postConfirmationUrl = `${chain.transactionService}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`;
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
        expect(body).toMatchObject({
          safeAddress: safe.address,
          txId: `multisig_${transaction.safe}_${transaction.safeTxHash}`,
          executedAt: expect.any(Number),
          txStatus: expect.any(String),
          txInfo: expect.any(Object),
          txData: expect.any(Object),
          txHash: transaction.transactionHash,
          detailedExecutionInfo: expect.any(Object),
          safeAppInfo: expect.any(Object),
        }),
      );
  });
});
