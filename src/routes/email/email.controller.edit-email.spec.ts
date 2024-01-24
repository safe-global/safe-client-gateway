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
import { EmailDataSourceModule } from '@/datasources/email/email.datasource.module';
import { TestEmailDatasourceModule } from '@/datasources/email/__tests__/test.email.datasource.module';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { getAddress } from 'viem';
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';
import { EmailAddress } from '@/domain/email/entities/email.entity';

const verificationCodeTtlMs = 100;

describe('Email controller edit email tests', () => {
  let app;
  let safeConfigUrl;
  let emailDatasource;
  let networkService;

  beforeEach(async () => {
    jest.clearAllMocks();
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
      .overrideModule(EmailDataSourceModule)
      .useModule(TestEmailDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    emailDatasource = moduleFixture.get(IEmailDataSource);
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

  it('edits email successfully', async () => {
    const chain = chainBuilder().build();
    const prevEmailAddress = faker.internet.email();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [accountAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    emailDatasource.getEmail.mockResolvedValue({
      emailAddress: new EmailAddress(prevEmailAddress),
    });
    emailDatasource.updateEmail.mockResolvedValue();

    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress,
        account: account.address,
        timestamp,
        signature,
      })
      .expect(202)
      .expect({});
  });

  it('should return 429 if trying to update email too often', async () => {
    const verificationGeneratedOn = faker.date.anytime();
    // Verification code is still valid as it is currently the same time it was generated
    jest.setSystemTime(verificationGeneratedOn.getTime());

    const chain = chainBuilder().build();
    const prevEmailAddress = faker.internet.email();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [accountAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    emailDatasource.getEmail.mockResolvedValue({
      emailAddress: new EmailAddress(prevEmailAddress),
      verificationGeneratedOn: verificationGeneratedOn,
    });
    emailDatasource.updateEmail.mockResolvedValue();

    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress,
        account: account.address,
        timestamp,
        signature,
      })
      .expect(429)
      .expect({
        statusCode: 429,
        message: 'Cannot edit at this time',
      });
  });

  it('should return 409 if trying to edit with the same email', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [accountAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    emailDatasource.getEmail.mockResolvedValue({
      emailAddress: new EmailAddress(emailAddress),
    });

    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress,
        account: account.address,
        timestamp,
        signature,
      })
      .expect(409)
      .expect({
        statusCode: 409,
        message: 'Email address matches that of the Safe owner.',
      });
    expect(emailDatasource.updateEmail).toHaveBeenCalledTimes(0);
  });

  it('should return 404 if trying to edit a non-existent email entry', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [accountAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    emailDatasource.getEmail.mockRejectedValue(
      new EmailAddressDoesNotExistError(
        chain.chainId,
        safe.address,
        accountAddress,
      ),
    );

    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress,
        account: account.address,
        timestamp,
        signature,
      })
      .expect(404)
      .expect({
        statusCode: 404,
        message: `No email address was found for the provided account ${accountAddress}.`,
      });
    expect(emailDatasource.updateEmail).toHaveBeenCalledTimes(0);
  });

  it('return 500 if updating fails in general', async () => {
    const chain = chainBuilder().build();
    const prevEmailAddress = faker.internet.email();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [accountAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    emailDatasource.getEmail.mockResolvedValue({
      emailAddress: new EmailAddress(prevEmailAddress),
    });
    emailDatasource.updateEmail.mockRejectedValue(new Error());

    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress,
        account: account.address,
        timestamp,
        signature,
      })
      .expect(500)
      .expect({
        code: 500,
        message: 'Internal server error',
      });
  });

  it('returns 403 is message was signed with a timestamp older than 5 minutes', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [accountAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });

    jest.advanceTimersByTime(5 * 60 * 1000);

    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress,
        account: account.address,
        timestamp,
        signature,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on wrong message signature', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [accountAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `some-action-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });

    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress,
        account: account.address,
        timestamp,
        signature,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if message not signed by owner', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `email-edit-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress,
        account: account.address,
        timestamp,
        signature,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });
});
