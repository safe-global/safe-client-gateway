import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { proposeTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/propose-transaction.dto.builder';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { concat, getAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { APP_FILTER } from '@nestjs/core';
import { getSignature } from '@/domain/common/utils/__tests__/signatures.builder';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import type { Delegate } from '@/domain/delegate/entities/delegate.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';

describe('Propose transaction - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let safeDecoderUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let loggingService: jest.MockedObjectDeep<ILoggingService>;

  async function initApp(config: typeof configuration): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(config)],
      providers: [
        // TODO: Add to all tests to reflect app implementation
        {
          provide: APP_FILTER,
          useClass: GlobalErrorFilter,
        },
      ],
    })
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    safeDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
    networkService = moduleFixture.get(NetworkService);
    loggingService = moduleFixture.get(LoggingService);

    // TODO: Override module to avoid spying
    jest.spyOn(loggingService, 'error');

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();

    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      features: {
        ...baseConfiguration.features,
        ethSign: true,
        trustedDelegateCall: true,
      },
    });

    await initApp(testConfiguration);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should throw a validation error', async () => {
    const safeAddress = faker.string.numeric();
    const proposeTransactionDto = proposeTransactionDtoBuilder().build();
    const { safeTxHash } = proposeTransactionDto;
    await request(app.getHttpServer())
      .post(`/v1/chains/${safeAddress}/transactions/${safeTxHash}/propose`)
      .send({ ...proposeTransactionDto, value: 1 })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['value'],
        message: 'Expected string, received number',
      });
  });

  it.each(Object.values(SignatureType))(
    'should propose a transaction with %s signature',
    async (signatureType) => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().with('chainId', chainId).build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder()
        .with('address', safeAddress)
        .with('owners', [signer.address])
        .build();
      const safeApps = [safeAppBuilder().build()];
      const contract = contractBuilder().build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('nonce', safe.nonce)
        .with(
          'origin',
          `{"url": "${faker.internet.url({
            appendSlash: false,
          })}", "name": "${faker.word.words()}", "note": "<script>document.write('<img src=s onerror=alert(Hello World)>')</script>"}`,
        )
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          safe,
          signers: [signer],
          signatureType,
        });
      const dataDecoded = dataDecodedBuilder().build();
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      const transactions = pageBuilder().build();
      const token = tokenBuilder().build();
      const gasToken = tokenBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
        const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        const getContractUrl = `${chain.transactionService}/api/v1/contracts/${transaction.to}`;
        const getTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.to}`;
        const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getMultisigTransactionsUrl:
            return Promise.resolve({ data: rawify(transactions), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getSafeAppsUrl:
            return Promise.resolve({ data: rawify(safeApps), status: 200 });
          case getContractUrl:
            return Promise.resolve({ data: rawify(contract), status: 200 });
          case getTokenUrl:
            return Promise.resolve({ data: rawify(token), status: 200 });
          case getGasTokenContractUrl:
            return Promise.resolve({ data: rawify(gasToken), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      networkService.post.mockImplementation(({ url }) => {
        const proposeTransactionUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
        const getDataDecodedUrl = `${safeDecoderUrl}/api/v1/data-decoder`;
        switch (url) {
          case proposeTransactionUrl:
            return Promise.resolve({ data: rawify({}), status: 200 });
          case getDataDecodedUrl:
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
              txId: `multisig_${safeAddress}_${transaction.safeTxHash}`,
              executedAt: transaction.executionDate?.getTime(),
              txStatus: expect.any(String),
              txInfo: expect.any(Object),
              detailedExecutionInfo: expect.objectContaining({
                type: 'MULTISIG',
                nonce: transaction.nonce,
              }),
              safeAppInfo: expect.any(Object),
              safeAddress,
              txHash: transaction.transactionHash,
              note: '',
            }),
          ),
        );
    },
  );

  it('should propose a transaction with concatenated signatures', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chain = chainBuilder().with('chainId', chainId).build();
    const signers = Array.from(
      { length: faker.number.int({ min: 2, max: 5 }) },
      () => {
        const privateKey = generatePrivateKey();
        return privateKeyToAccount(privateKey);
      },
    );
    const safe = safeBuilder()
      .with('address', safeAddress)
      .with(
        'owners',
        signers.map((s) => s.address),
      )
      .build();
    const safeApps = [safeAppBuilder().build()];
    const contract = contractBuilder().build();
    const transaction = await multisigTransactionBuilder()
      .with('safe', safeAddress)
      .with('nonce', safe.nonce)
      .with('operation', Operation.CALL)
      .buildWithConfirmations({
        chainId,
        safe,
        signers,
      });
    const dataDecoded = dataDecodedBuilder().build();
    const proposeTransactionDto = proposeTransactionDtoBuilder()
      .with('to', transaction.to)
      .with('value', transaction.value)
      .with('data', transaction.data)
      .with('nonce', transaction.nonce.toString())
      .with('operation', transaction.operation)
      .with('safeTxGas', transaction.safeTxGas!.toString())
      .with('baseGas', transaction.baseGas!.toString())
      .with('gasPrice', transaction.gasPrice!)
      .with('gasToken', transaction.gasToken!)
      .with('refundReceiver', transaction.refundReceiver)
      .with('safeTxHash', transaction.safeTxHash)
      .with('sender', transaction.confirmations![0].owner)
      .with(
        'signature',
        concat(transaction.confirmations!.map((c) => c.signature!)),
      )
      .build();
    const transactions = pageBuilder().build();
    const token = tokenBuilder().build();
    const gasToken = tokenBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getContractUrl = `${chain.transactionService}/api/v1/contracts/${transaction.to}`;
      const getTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.to}`;
      const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(transaction)),
            status: 200,
          });
        case getMultisigTransactionsUrl:
          return Promise.resolve({ data: rawify(transactions), status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getSafeAppsUrl:
          return Promise.resolve({ data: rawify(safeApps), status: 200 });
        case getContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        case getTokenUrl:
          return Promise.resolve({ data: rawify(token), status: 200 });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: rawify(gasToken), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    networkService.post.mockImplementation(({ url }) => {
      const proposeTransactionUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getDataDecodedUrl = `${safeDecoderUrl}/api/v1/data-decoder`;
      switch (url) {
        case proposeTransactionUrl:
          return Promise.resolve({ data: rawify({}), status: 200 });
        case getDataDecodedUrl:
          return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
            txId: `multisig_${safeAddress}_${transaction.safeTxHash}`,
            executedAt: transaction.executionDate?.getTime(),
            txStatus: expect.any(String),
            txInfo: expect.any(Object),
            detailedExecutionInfo: expect.objectContaining({
              type: 'MULTISIG',
              nonce: transaction.nonce,
            }),
            safeAppInfo: expect.any(Object),
            safeAddress,
            txHash: transaction.transactionHash,
          }),
        ),
      );
  });

  it('should propose a transaction from a delegate', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chain = chainBuilder().with('chainId', chainId).build();
    const [delegate, ...signers] = Array.from(
      { length: faker.number.int({ min: 2, max: 5 }) },
      () => {
        const privateKey = generatePrivateKey();
        return privateKeyToAccount(privateKey);
      },
    );
    const safe = safeBuilder()
      .with('address', safeAddress)
      .with(
        'owners',
        signers.map((s) => s.address),
      )
      .build();
    const safeApps = [safeAppBuilder().build()];
    const contract = contractBuilder().build();
    const transaction = await multisigTransactionBuilder()
      .with('safe', safeAddress)
      .with('nonce', safe.nonce)
      .with('operation', Operation.CALL)
      .buildWithConfirmations({
        chainId,
        safe,
        signers,
      });
    const dataDecoded = dataDecodedBuilder().build();
    const signature = await getSignature({
      signer: delegate,
      hash: transaction.safeTxHash,
      signatureType: faker.helpers.enumValue(SignatureType),
    });
    const proposeTransactionDto = proposeTransactionDtoBuilder()
      .with('to', transaction.to)
      .with('value', transaction.value)
      .with('data', transaction.data)
      .with('nonce', transaction.nonce.toString())
      .with('operation', transaction.operation)
      .with('safeTxGas', transaction.safeTxGas!.toString())
      .with('baseGas', transaction.baseGas!.toString())
      .with('gasPrice', transaction.gasPrice!)
      .with('gasToken', transaction.gasToken!)
      .with('refundReceiver', transaction.refundReceiver)
      .with('safeTxHash', transaction.safeTxHash)
      .with('sender', delegate.address)
      .with('signature', signature)
      .build();
    const transactions = pageBuilder().build();
    const token = tokenBuilder().build();
    const gasToken = tokenBuilder().build();
    const delegates = pageBuilder<Delegate>()
      .with('results', [
        delegateBuilder().with('delegate', delegate.address).build(),
      ])
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getContractUrl = `${chain.transactionService}/api/v1/contracts/${transaction.to}`;
      const getTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.to}`;
      const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      const getDelegatesUrl = `${chain.transactionService}/api/v2/delegates/`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(transaction)),
            status: 200,
          });
        case getMultisigTransactionsUrl:
          return Promise.resolve({ data: rawify(transactions), status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getSafeAppsUrl:
          return Promise.resolve({ data: rawify(safeApps), status: 200 });
        case getContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        case getTokenUrl:
          return Promise.resolve({ data: rawify(token), status: 200 });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: rawify(gasToken), status: 200 });
        case getDelegatesUrl:
          return Promise.resolve({
            data: rawify(delegates),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    networkService.post.mockImplementation(({ url }) => {
      const proposeTransactionUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const getDataDecodedUrl = `${safeDecoderUrl}/api/v1/data-decoder`;
      switch (url) {
        case proposeTransactionUrl:
          return Promise.resolve({ data: rawify({}), status: 200 });
        case getDataDecodedUrl:
          return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
            txId: `multisig_${safeAddress}_${transaction.safeTxHash}`,
          }),
        ),
      );
  });

  describe('Verification', () => {
    it('should throw if the nonce is below that of the Safe', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce - 1)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signer],
        });
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          message: 'Invalid nonce',
          statusCode: 422,
        });

      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it('should allow trusted delegate calls', async () => {
      const baseConfiguration = configuration();
      const testConfiguration = (): typeof baseConfiguration => ({
        ...baseConfiguration,
        features: {
          ...baseConfiguration.features,
          ethSign: true,
          trustedDelegateCall: true,
          trustedForDelegateCallContractsList: true,
        },
      });
      await initApp(testConfiguration);

      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().with('chainId', chainId).build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder()
        .with('address', safeAddress)
        .with('owners', [signer.address])
        .build();
      const safeApps = [safeAppBuilder().build()];
      const transaction = await multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('nonce', safe.nonce)
        .with('operation', Operation.DELEGATE)
        .buildWithConfirmations({
          chainId,
          safe,
          signers: [signer],
        });
      const dataDecoded = dataDecodedBuilder().build();
      const contractPage = pageBuilder()
        .with('results', [
          contractBuilder().with('trustedForDelegateCall', true).build(),
          contractBuilder()
            .with('trustedForDelegateCall', true)
            .with('address', transaction.to) // transaction.to address is a trusted contract
            .build(),
          contractBuilder().with('trustedForDelegateCall', true).build(),
        ])
        .with('next', null)
        .build();
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      const transactions = pageBuilder().build();
      const token = tokenBuilder().build();
      const gasToken = tokenBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
        const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        const getContractsUrl = `${chain.transactionService}/api/v1/contracts/`;
        const getTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.to}`;
        const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getMultisigTransactionsUrl:
            return Promise.resolve({ data: rawify(transactions), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getSafeAppsUrl:
            return Promise.resolve({ data: rawify(safeApps), status: 200 });
          case getContractsUrl:
            return Promise.resolve({ data: rawify(contractPage), status: 200 });
          case getTokenUrl:
            return Promise.resolve({ data: rawify(token), status: 200 });
          case getGasTokenContractUrl:
            return Promise.resolve({ data: rawify(gasToken), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      networkService.post.mockImplementation(({ url }) => {
        const proposeTransactionUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
        const getDataDecodedUrl = `${safeDecoderUrl}/api/v1/data-decoder`;
        switch (url) {
          case proposeTransactionUrl:
            return Promise.resolve({ data: rawify({}), status: 200 });
          case getDataDecodedUrl:
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
              txId: `multisig_${safeAddress}_${transaction.safeTxHash}`,
            }),
          ),
        );
    });

    it('should throw for delegate calls by default', async () => {
      const baseConfiguration = configuration();
      const testConfiguration = (): typeof baseConfiguration => ({
        ...baseConfiguration,
        features: {
          ...baseConfiguration.features,
          ethSign: true,
          trustedDelegateCall: false,
        },
      });
      await initApp(testConfiguration);

      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().with('chainId', chainId).build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder()
        .with('address', safeAddress)
        .with('owners', [signer.address])
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('nonce', safe.nonce)
        .with('operation', Operation.DELEGATE)
        .buildWithConfirmations({
          chainId,
          safe,
          signers: [signer],
        });
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/transactions/${safeAddress}/propose`)
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          message: 'Delegate call is disabled',
          statusCode: 422,
        });

      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it('should throw for untrusted delegate calls if only trusted delegate calls are enabled', async () => {
      const baseConfiguration = configuration();
      const testConfiguration = (): typeof baseConfiguration => ({
        ...baseConfiguration,
        features: {
          ...baseConfiguration.features,
          ethSign: true,
          trustedDelegateCall: true,
          trustedForDelegateCallContractsList: true,
        },
      });
      await initApp(testConfiguration);

      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().with('chainId', chainId).build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder()
        .with('address', safeAddress)
        .with('owners', [signer.address])
        .build();
      const safeApps = [safeAppBuilder().build()];
      const transaction = await multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('nonce', safe.nonce)
        .with('operation', Operation.DELEGATE)
        .buildWithConfirmations({
          chainId,
          safe,
          signers: [signer],
        });
      const contractPage = pageBuilder()
        .with('results', [
          // transaction.to address is not in the list of trusted contracts
          contractBuilder().with('trustedForDelegateCall', true).build(),
          contractBuilder().with('trustedForDelegateCall', true).build(),
        ])
        .with('next', null)
        .build();
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      const transactions = pageBuilder().build();
      const token = tokenBuilder().build();
      const gasToken = tokenBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
        const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        const getContractsUrl = `${chain.transactionService}/api/v1/contracts/`;
        const getTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.to}`;
        const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getMultisigTransactionsUrl:
            return Promise.resolve({
              data: rawify(transactions),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getSafeAppsUrl:
            return Promise.resolve({ data: rawify(safeApps), status: 200 });
          case getContractsUrl:
            return Promise.resolve({
              data: rawify(contractPage),
              status: 200,
            });
          case getTokenUrl:
            return Promise.resolve({ data: rawify(token), status: 200 });
          case getGasTokenContractUrl:
            return Promise.resolve({ data: rawify(gasToken), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      networkService.post.mockImplementation(({ url }) => {
        const proposeTransactionUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
        switch (url) {
          case proposeTransactionUrl:
            return Promise.resolve({ data: rawify({}), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/transactions/${safeAddress}/propose`)
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          message: 'Delegate call is disabled',
          statusCode: 422,
        });

      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it('should throw for delegate calls when the contract cannot be found and only trusted delegate calls are enabled', async () => {
      const baseConfiguration = configuration();
      const testConfiguration = (): typeof baseConfiguration => ({
        ...baseConfiguration,
        features: {
          ...baseConfiguration.features,
          ethSign: true,
          trustedDelegateCall: true,
          trustedForDelegateCallContractsList: true,
        },
      });
      await initApp(testConfiguration);

      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().with('chainId', chainId).build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder()
        .with('address', safeAddress)
        .with('owners', [signer.address])
        .build();
      const safeApps = [safeAppBuilder().build()];
      const transaction = await multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('nonce', safe.nonce)
        .with('operation', Operation.DELEGATE)
        .buildWithConfirmations({
          chainId,
          safe,
          signers: [signer],
        });
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      const transactions = pageBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
        const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        const getContractsUrl = `${chain.transactionService}/api/v1/contracts/`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getMultisigTransactionsUrl:
            return Promise.resolve({
              data: rawify(transactions),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getSafeAppsUrl:
            return Promise.resolve({ data: rawify(safeApps), status: 200 });
          case getContractsUrl:
            return Promise.reject(new Error('Contracts not found'));
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/transactions/${safeAddress}/propose`)
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          message: 'Delegate call is disabled',
          statusCode: 422,
        });

      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it('should throw and log if the safeTxHash could not be calculated', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signer],
        });
      safe.version = null;
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          message: 'Could not calculate safeTxHash',
          statusCode: 422,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        message: 'Could not calculate safeTxHash',
        chainId: chain.chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        transaction: {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data,
          operation: transaction.operation,
          safeTxGas: transaction.safeTxGas,
          baseGas: transaction.baseGas,
          gasPrice: transaction.gasPrice,
          gasToken: transaction.gasToken,
          refundReceiver: transaction.refundReceiver,
          nonce: transaction.nonce,
        },
        source: 'PROPOSAL',
      });
    });

    it('should throw and log if the safeTxHash does not match', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signer],
        });
      transaction.data = faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`;
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          message: 'Invalid safeTxHash',
          statusCode: 422,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        event: 'safeTxHash does not match',
        chainId: chain.chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        transaction: {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data,
          operation: transaction.operation,
          safeTxGas: transaction.safeTxGas,
          baseGas: transaction.baseGas,
          gasPrice: transaction.gasPrice,
          gasToken: transaction.gasToken,
          refundReceiver: transaction.refundReceiver,
          nonce: transaction.nonce,
        },
        type: 'TRANSACTION_VALIDITY',
        source: 'PROPOSAL',
      });
    });

    it('should throw if a signature is not a valid hex bytes string', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signer],
        });
      transaction.confirmations![0].signature =
        transaction.confirmations![0].signature!.slice(0, 129) as `0x${string}`;
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid hex bytes',
          path: ['signature'],
        });

      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it('should throw if the signature length is invalid', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signer],
        });
      transaction.confirmations![0].signature =
        transaction.confirmations![0].signature!.slice(0, 128) as `0x${string}`;
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', '0xdeadbeef')
        .build();

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid signature',
          path: ['signature'],
        });

      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it.each(Object.values(SignatureType))(
      'should throw and log if a %s signature is invalid',
      async (signatureType) => {
        const chain = chainBuilder().build();
        const privateKey = generatePrivateKey();
        const signer = privateKeyToAccount(privateKey);
        const safe = safeBuilder().with('owners', [signer.address]).build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce)
          .with('operation', Operation.CALL)
          .buildWithConfirmations({
            chainId: chain.chainId,
            safe,
            signers: [signer],
            signatureType,
          });
        const v = transaction.confirmations![0].signature?.slice(-2);
        const proposeTransactionDto = proposeTransactionDtoBuilder()
          .with('to', transaction.to)
          .with('value', transaction.value)
          .with('data', transaction.data)
          .with('nonce', transaction.nonce.toString())
          .with('operation', transaction.operation)
          .with('safeTxGas', transaction.safeTxGas!.toString())
          .with('baseGas', transaction.baseGas!.toString())
          .with('gasPrice', transaction.gasPrice!)
          .with('gasToken', transaction.gasToken!)
          .with('refundReceiver', transaction.refundReceiver)
          .with('safeTxHash', transaction.safeTxHash)
          .with('sender', transaction.confirmations![0].owner)
          .with('signature', `0x${'-'.repeat(128)}${v}`)
          .build();
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case getChainUrl:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case getMultisigTransactionUrl:
              return Promise.resolve({
                data: rawify(multisigToJson(transaction)),
                status: 200,
              });
            case getSafeUrl:
              return Promise.resolve({ data: rawify(safe), status: 200 });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        await request(app.getHttpServer())
          .post(
            `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
          )
          .send(proposeTransactionDto)
          .expect(422)
          .expect({
            statusCode: 422,
            code: 'custom',
            message: 'Invalid "0x" notated hex string',
            path: ['signature'],
          });

        expect(loggingService.error).not.toHaveBeenCalled();
      },
    );

    it('should throw and log if a signer is blocked', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => ({
        ...defaultConfiguration,
        blockchain: {
          ...defaultConfiguration.blockchain,
          blocklist: [signer.address],
        },
      });
      await initApp(testConfiguration);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signer],
        });
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          message: 'Unauthorized address',
          statusCode: 422,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        event: 'Unauthorized address',
        chainId: chain.chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        blockedAddress: signer.address,
        type: 'TRANSACTION_VALIDITY',
        source: 'PROPOSAL',
      });
    });

    it('should throw if eth_sign is disabled', async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          ethSign: false,
        },
      });
      await initApp(testConfiguration);
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers: [signer],
          signatureType: SignatureType.EthSign,
        });
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      transaction.confirmations = [];
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          message: 'eth_sign is disabled',
          statusCode: 422,
        });

      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it('should not throw if the eth_sign signature is an existing signature', async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          ethSign: false,
        },
      });
      await initApp(testConfiguration);
      const chain = chainBuilder().build();
      const signers = Array.from(
        { length: faker.number.int({ min: 2, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const safeApps = [safeAppBuilder().build()];
      const contract = contractBuilder().build();
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .with('confirmations', [])
        .build();
      const dataDecoded = dataDecodedBuilder().build();
      transaction.safeTxHash = getSafeTxHash({
        chainId: chain.chainId,
        safe,
        transaction,
      });
      const ethSignSignature = await getSignature({
        signer: signers[0],
        hash: transaction.safeTxHash,
        signatureType: SignatureType.EthSign,
      });
      // First confirmation is eth_sign
      transaction.confirmations?.push(
        confirmationBuilder()
          .with('owner', signers[0].address)
          .with('signature', ethSignSignature)
          .with('signatureType', SignatureType.EthSign)
          .build(),
      );
      for (const signer of signers.slice(1)) {
        const signatureType = faker.helpers.arrayElement([
          SignatureType.ApprovedHash,
          SignatureType.ContractSignature,
          SignatureType.Eoa,
        ]);
        const signature = await getSignature({
          signer,
          hash: transaction.safeTxHash,
          signatureType,
        });
        transaction.confirmations?.push(
          confirmationBuilder()
            .with('owner', signer.address)
            .with('signature', signature)
            .with('signatureType', signatureType)
            .build(),
        );
      }
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        // Sender is the last signer
        .with('sender', transaction.confirmations!.at(-1)!.owner)
        .with(
          'signature',
          // eth_sign is included in concatenated proposal
          concat(
            transaction.confirmations!.map(
              (confirmation) => confirmation.signature!,
            ),
          ),
        )
        .build();
      const transactions = pageBuilder().build();
      const token = tokenBuilder().build();
      const gasToken = tokenBuilder().build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getContractUrl = `${chain.transactionService}/api/v1/contracts/${transaction.to}`;
      const getTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.to}`;
      const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getMultisigTransactionsUrl:
            return Promise.resolve({ data: rawify(transactions), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getSafeAppsUrl:
            return Promise.resolve({ data: rawify(safeApps), status: 200 });
          case getContractUrl:
            return Promise.resolve({ data: rawify(contract), status: 200 });
          case getTokenUrl:
            return Promise.resolve({ data: rawify(token), status: 200 });
          case getGasTokenContractUrl:
            return Promise.resolve({ data: rawify(gasToken), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      networkService.post.mockImplementation(({ url }) => {
        const proposeTransactionUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
        const getDataDecodedUrl = `${safeDecoderUrl}/api/v1/data-decoder`;
        switch (url) {
          case proposeTransactionUrl:
            return Promise.resolve({ data: rawify({}), status: 200 });
          case getDataDecodedUrl:
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposeTransactionDto)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual(
            expect.objectContaining({
              txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
            }),
          ),
        );
    });

    it('should throw and log if the signer is not the sender', async () => {
      const chain = chainBuilder().build();
      const [sender, ...signers] = Array.from(
        { length: faker.number.int({ min: 2, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe,
          signers,
        });
      const signature = await getSignature({
        signer: sender,
        hash: transaction.safeTxHash,
        signatureType: faker.helpers.enumValue(SignatureType),
      });
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', getAddress(faker.finance.ethereumAddress()))
        .with('signature', signature)
        .build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/propose`,
        )
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          message: 'Invalid signature',
          statusCode: 422,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        event: 'Recovered address does not match signer',
        chainId: chain.chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        signerAddress: proposeTransactionDto.sender,
        signature: proposeTransactionDto.signature,
        type: 'TRANSACTION_VALIDITY',
        source: 'PROPOSAL',
      });
    });

    it('should throw and log if the signers are not all owners or delegates', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().with('chainId', chainId).build();
      const [delegate, ...signers] = Array.from(
        { length: faker.number.int({ min: 2, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with('address', safeAddress)
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          safe,
          signers,
        });
      const signature = await getSignature({
        signer: delegate,
        hash: transaction.safeTxHash,
        signatureType: faker.helpers.enumValue(SignatureType),
      });
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', delegate.address)
        .with('signature', signature)
        .build();
      const delegates = pageBuilder<Delegate>().with('results', []).build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
        const getDelegatesUrl = `${chain.transactionService}/api/v2/delegates/`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({
              data: rawify(multisigToJson(transaction)),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getDelegatesUrl:
            return Promise.resolve({
              data: rawify(delegates),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/transactions/${safeAddress}/propose`)
        .send(proposeTransactionDto)
        .expect(422)
        .expect({
          message: 'Invalid signature',
          statusCode: 422,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        event: 'Recovered address does not match signer',
        chainId: chain.chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        signerAddress: proposeTransactionDto.sender,
        signature: proposeTransactionDto.signature,
        type: 'TRANSACTION_VALIDITY',
        source: 'PROPOSAL',
      });
    });
  });
});
