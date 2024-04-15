import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { INestApplication } from '@nestjs/common';
import { AccountDoesNotExistError } from '@/domain/account/errors/account-does-not-exist.error';
import {
  Account,
  EmailAddress,
} from '@/domain/account/entities/account.entity';
import { accountBuilder } from '@/domain/account/entities/__tests__/account.builder';
import { getAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';

const verificationCodeTtlMs = 100;

describe('Email controller edit email tests', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let accountDataSource: jest.MockedObjectDeep<IAccountDataSource>;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    const defaultConfiguration = configuration();

    const testConfiguration: typeof configuration = () => {
      return {
        ...defaultConfiguration,
        email: {
          ...defaultConfiguration.email,
          verificationCode: {
            ...defaultConfiguration.email.verificationCode,
            ttlMs: verificationCodeTtlMs,
          },
        },
      };
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration), EmailControllerModule],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    accountDataSource = moduleFixture.get(IAccountDataSource);
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    // non-checksummed address
    { safeAddress: faker.finance.ethereumAddress().toLowerCase() },
    // checksummed address
    { safeAddress: getAddress(faker.finance.ethereumAddress()) },
  ])('edits email successfully', async ({ safeAddress }) => {
    const chain = chainBuilder().build();
    const prevEmailAddress = faker.internet.email();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const signerAddress = signer.address;
    const safe = safeBuilder()
      // Allow test of non-checksummed address by casting
      .with('address', safeAddress as `0x${string}`)
      .build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${signerAddress}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    accountDataSource.getAccount.mockResolvedValue(
      accountBuilder()
        .with('chainId', chain.chainId)
        .with('signer', signerAddress)
        .with('isVerified', true)
        .with('safeAddress', getAddress(safe.address))
        .with('emailAddress', new EmailAddress(prevEmailAddress))
        .build(),
    );
    accountDataSource.updateAccountEmail.mockResolvedValue(
      accountBuilder()
        .with('emailAddress', new EmailAddress(emailAddress))
        .build(),
    );

    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signer.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
      })
      .expect(202)
      .expect({});

    expect(accountDataSource.updateAccountEmail).toHaveBeenCalledTimes(1);
    expect(accountDataSource.updateAccountEmail).toHaveBeenCalledWith({
      chainId: chain.chainId,
      emailAddress: new EmailAddress(emailAddress),
      // Should always call with the checksummed address
      safeAddress: getAddress(safe.address),
      signer: signerAddress,
      unsubscriptionToken: expect.any(String),
    });
    expect(accountDataSource.setEmailVerificationCode).toHaveBeenCalledTimes(1);
    expect(accountDataSource.setEmailVerificationCode).toHaveBeenCalledWith({
      chainId: chain.chainId,
      code: expect.any(String),
      signer: signerAddress,
      // Should always call with the checksummed address
      safeAddress: getAddress(safe.address),
      codeGenerationDate: expect.any(Date),
    });
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).toHaveBeenCalledTimes(1);
    expect(accountDataSource.setEmailVerificationSentDate).toHaveBeenCalledWith(
      {
        chainId: chain.chainId,
        // Should always call with the checksummed address
        safeAddress: getAddress(safe.address),
        signer: signerAddress,
        sentOn: expect.any(Date),
      },
    );
    // TODO: validate that `IEmailApi.createMessage` is triggered with the correct code
  });

  it('should return 409 if trying to edit with the same email', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const signerAddress = signer.address;
    const safe = safeBuilder().build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${signerAddress}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    accountDataSource.getAccount.mockResolvedValue({
      emailAddress: new EmailAddress(emailAddress),
    } as Account);

    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signer.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
      })
      .expect(409)
      .expect({
        statusCode: 409,
        message: 'Email address matches that of the Safe owner.',
      });

    expect(accountDataSource.updateAccountEmail).toHaveBeenCalledTimes(0);
    expect(accountDataSource.setEmailVerificationCode).toHaveBeenCalledTimes(0);
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).toHaveBeenCalledTimes(0);
  });

  it('returns 422 if Safe address is not a valid Ethereum address', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const signerAddress = signer.address;
    const invalidSafeAddress = faker.word.sample();
    const message = `email-edit-${chain.chainId}-${invalidSafeAddress}-${emailAddress}-${signerAddress}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    accountDataSource.getAccount.mockResolvedValue({
      emailAddress: new EmailAddress(emailAddress),
    } as Account);

    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${invalidSafeAddress}/emails/${signer.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
      })
      .expect(422)
      .expect({
        message: `Address "${invalidSafeAddress}" is invalid.`,
        error: 'Unprocessable Entity',
        statusCode: 422,
      });

    expect(accountDataSource.updateAccountEmail).toHaveBeenCalledTimes(0);
    expect(accountDataSource.setEmailVerificationCode).toHaveBeenCalledTimes(0);
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).toHaveBeenCalledTimes(0);
  });

  it('should return 404 if trying to edit a non-existent email entry', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const signerAddress = signer.address;
    const safe = safeBuilder().build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${signerAddress}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    accountDataSource.getAccount.mockRejectedValue(
      new AccountDoesNotExistError(chain.chainId, safe.address, signerAddress),
    );

    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signer.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
      })
      .expect(404)
      .expect({
        statusCode: 404,
        message: `No email address was found for the provided signer ${signerAddress}.`,
      });

    expect(accountDataSource.updateAccountEmail).toHaveBeenCalledTimes(0);
    expect(accountDataSource.setEmailVerificationCode).toHaveBeenCalledTimes(0);
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).toHaveBeenCalledTimes(0);
  });

  it('return 500 if updating fails in general', async () => {
    const chain = chainBuilder().build();
    const prevEmailAddress = faker.internet.email();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const signerAddress = signer.address;
    const safe = safeBuilder().build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${signerAddress}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    accountDataSource.getAccount.mockResolvedValue({
      emailAddress: new EmailAddress(prevEmailAddress),
    } as Account);
    accountDataSource.updateAccountEmail.mockRejectedValue(new Error());

    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signer.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
      })
      .expect(500)
      .expect({
        code: 500,
        message: 'Internal server error',
      });

    expect(accountDataSource.updateAccountEmail).toHaveBeenCalledTimes(1);
    expect(accountDataSource.setEmailVerificationCode).toHaveBeenCalledTimes(0);
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).toHaveBeenCalledTimes(0);
  });

  it('returns 403 is message was signed with a timestamp older than 5 minutes', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    const safe = safeBuilder().build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });

    jest.advanceTimersByTime(5 * 60 * 1000);

    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${account.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(accountDataSource.updateAccountEmail).toHaveBeenCalledTimes(0);
    expect(accountDataSource.setEmailVerificationCode).toHaveBeenCalledTimes(0);
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).toHaveBeenCalledTimes(0);
  });

  it('returns 403 on wrong message signature', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    const safe = safeBuilder().build();
    const message = `some-action-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });

    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${account.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(accountDataSource.updateAccountEmail).toHaveBeenCalledTimes(0);
    expect(accountDataSource.setEmailVerificationCode).toHaveBeenCalledTimes(0);
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).toHaveBeenCalledTimes(0);
  });
});
