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
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import {
  multisigTransactionBuilder,
  toJson as multisigToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { TransactionsModule } from '@/routes/transactions/transactions.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { addConfirmationDtoBuilder } from '@/routes/transactions/__tests__/entities/add-confirmation.dto.builder';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { APP_FILTER } from '@nestjs/core';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { ZodErrorFilter } from '@/routes/common/filters/zod-error.filter';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { getAddress } from 'viem';
import { dataDecodedBuilder } from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';

describe('Add transaction confirmations - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let safeDecoderUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let loggingService: jest.MockedObjectDeep<ILoggingService>;

  async function initApp(config: typeof configuration): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        TransactionsModule,
        // common
        TestCacheModule,
        ConfigurationModule.register(config),
        TestLoggingModule,
        TestNetworkModule,
      ],
      providers: [
        // TODO: Add to all tests to reflect app implementation
        {
          provide: APP_FILTER,
          useClass: GlobalErrorFilter,
        },
        { provide: APP_FILTER, useClass: ZodErrorFilter },
      ],
    }).compile();

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
      },
    });

    await initApp(testConfiguration);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should throw a validation error', async () => {
    await request(app.getHttpServer())
      .post(
        `/v1/chains/${faker.string.numeric()}/transactions/${faker.finance.ethereumAddress()}/confirmations`,
      )
      .send({ signature: 1 })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['signature'],
        message: 'Expected string, received number',
      });
  });

  it.each(Object.values(SignatureType))(
    'should confirm a transaction with a %s signature and return the updated transaction',
    async (signatureType) => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const safeApps = [safeAppBuilder().build()];
      const contract = contractBuilder().build();
      const transaction = multisigToJson(
        await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce)
          .with('isExecuted', false)
          .buildWithConfirmations({
            signers: [signer],
            chainId: chain.chainId,
            safe,
            signatureType,
          }),
      ) as MultisigTransaction;
      const dataDecoder = dataDecodedBuilder().build();
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with('signature', transaction.confirmations![0].signature!)
        .build();
      const gasToken = tokenBuilder().build();
      const token = tokenBuilder().build();
      const rejectionTxsPage = pageBuilder().with('results', []).build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/`;
        const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
        const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${transaction.to}`;
        const getToTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.to}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({ data: rawify(transaction), status: 200 });
          case getMultisigTransactionsUrl:
            return Promise.resolve({
              data: rawify(rejectionTxsPage),
              status: 200,
            });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          case getSafeAppsUrl:
            return Promise.resolve({ data: rawify(safeApps), status: 200 });
          case getGasTokenContractUrl:
            return Promise.resolve({ data: rawify(gasToken), status: 200 });
          case getToContractUrl:
            return Promise.resolve({ data: rawify(contract), status: 200 });
          case getToTokenUrl:
            return Promise.resolve({ data: rawify(token), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      networkService.post.mockImplementation(({ url }) => {
        const postConfirmationUrl = `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/confirmations/`;
        const getDataDecoderUrl = `${safeDecoderUrl}/api/v1/data-decoder`;
        switch (url) {
          case postConfirmationUrl:
            return Promise.resolve({ data: rawify({}), status: 200 });
          case getDataDecoderUrl:
            return Promise.resolve({ data: rawify(dataDecoder), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
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
    },
  );

  describe('Verification', () => {
    it('should throw for executed transactions', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = multisigToJson(
        await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce)
          .with('isExecuted', true)
          .buildWithConfirmations({
            signers: [signer],
            chainId: chain.chainId,
            safe,
          }),
      ) as MultisigTransaction;
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with('signature', transaction.confirmations![0].signature!)
        .build();
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({ data: rawify(transaction), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
        )
        .send(addConfirmationDto)
        .expect(422)
        .expect({
          message: 'Invalid nonce',
          statusCode: 422,
        });

      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it('should throw if the nonce is below that of the Safe', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = multisigToJson(
        await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce - 1)
          .with('isExecuted', false)
          .buildWithConfirmations({
            signers: [signer],
            chainId: chain.chainId,
            safe,
          }),
      ) as MultisigTransaction;
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with('signature', transaction.confirmations![0].signature!)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({ data: rawify(transaction), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
        )
        .send(addConfirmationDto)
        .expect(422)
        .expect({
          message: 'Invalid nonce',
          statusCode: 422,
        });

      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it('should throw and log if the safeTxHash could not be calculated', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = multisigToJson(
        await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce)
          .with('isExecuted', false)
          .buildWithConfirmations({
            signers: [signer],
            chainId: chain.chainId,
            safe,
          }),
      ) as MultisigTransaction;
      safe.version = null;
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with('signature', transaction.confirmations![0].signature!)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({ data: rawify(transaction), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
        )
        .send(addConfirmationDto)
        .expect(502)
        .expect({
          statusCode: 502,
          message: 'Could not calculate safeTxHash',
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
        source: 'API',
      });
    });

    it('should throw and log if the safeTxHash does not match', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = multisigToJson(
        await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce)
          .with('isExecuted', false)
          .buildWithConfirmations({
            signers: [signer],
            chainId: chain.chainId,
            safe,
          }),
      ) as MultisigTransaction;
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with('signature', transaction.confirmations![0].signature!)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({ data: rawify(transaction), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });
      transaction.data = faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`;

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
        )
        .send(addConfirmationDto)
        .expect(502)
        .expect({
          statusCode: 502,
          message: 'Invalid safeTxHash',
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
        source: 'API',
      });
    });

    it('should throw if a signature is not a valid hex bytes string', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = multisigToJson(
        await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce - 1)
          .with('isExecuted', false)
          .buildWithConfirmations({
            signers: [signer],
            chainId: chain.chainId,
            safe,
          }),
      ) as MultisigTransaction;
      transaction.confirmations![0].signature =
        transaction.confirmations![0].signature!.slice(0, 129) as `0x${string}`;
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with('signature', transaction.confirmations![0].signature)
        .build();

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
        )
        .send(addConfirmationDto)
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
      const transaction = multisigToJson(
        await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce - 1)
          .with('isExecuted', false)
          .buildWithConfirmations({
            signers: [signer],
            chainId: chain.chainId,
            safe,
          }),
      ) as MultisigTransaction;
      transaction.confirmations![0].signature =
        transaction.confirmations![0].signature!.slice(0, 128) as `0x${string}`;
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with('signature', transaction.confirmations![0].signature)
        .build();

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
        )
        .send(addConfirmationDto)
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
        const transaction = multisigToJson(
          await multisigTransactionBuilder()
            .with('safe', safe.address)
            .with('nonce', safe.nonce)
            .with('isExecuted', false)
            .buildWithConfirmations({
              signers: [signer],
              chainId: chain.chainId,
              safe,
              signatureType,
            }),
        ) as MultisigTransaction;
        const v = transaction.confirmations![0].signature?.slice(-2);
        const addConfirmationDto = addConfirmationDtoBuilder()
          .with('signature', `0x${'-'.repeat(128)}${v}`)
          .build();

        await request(app.getHttpServer())
          .post(
            `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
          )
          .send(addConfirmationDto)
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
      const transaction = multisigToJson(
        await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce)
          .with('isExecuted', false)
          .buildWithConfirmations({
            signers: [signer],
            chainId: chain.chainId,
            safe,
          }),
      ) as MultisigTransaction;
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with('signature', transaction.confirmations![0].signature!)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({ data: rawify(transaction), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
        )
        .send(addConfirmationDto)
        .expect(502)
        .expect({
          message: 'Unauthorized address',
          statusCode: 502,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        event: 'Unauthorized address',
        chainId: chain.chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        blockedAddress: signer.address,
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
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
      const transaction = multisigToJson(
        await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce)
          .with('isExecuted', false)
          .buildWithConfirmations({
            signers: [signer],
            chainId: chain.chainId,
            safe,
            signatureType: SignatureType.EthSign,
          }),
      ) as MultisigTransaction;
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with('signature', transaction.confirmations![0].signature!)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({ data: rawify(transaction), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
        )
        .send(addConfirmationDto)
        .expect(422)
        .expect({
          message: 'eth_sign is disabled',
          statusCode: 422,
        });

      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it('should throw and log if the signer is not an owner', async () => {
      const chain = chainBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = multisigToJson(
        await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce)
          .with('isExecuted', false)
          .buildWithConfirmations({
            signers: [signer],
            chainId: chain.chainId,
            safe,
          }),
      ) as MultisigTransaction;
      safe.owners = [getAddress(faker.finance.ethereumAddress())];
      const addConfirmationDto = addConfirmationDtoBuilder()
        .with('signature', transaction.confirmations![0].signature!)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
        switch (url) {
          case getChainUrl:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case getMultisigTransactionUrl:
            return Promise.resolve({ data: rawify(transaction), status: 200 });
          case getSafeUrl:
            return Promise.resolve({ data: rawify(safe), status: 200 });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${transaction.safeTxHash}/confirmations`,
        )
        .send(addConfirmationDto)
        .expect(502)
        .expect({
          message: 'Invalid signature',
          statusCode: 502,
        });

      expect(loggingService.error).toHaveBeenCalledWith({
        event: 'Recovered address does not match signer',
        chainId: chain.chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        signerAddress: transaction.confirmations![0].owner,
        signature: transaction.confirmations![0].signature,
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
      });
    });
  });
});
