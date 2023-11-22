import { Test, TestingModule } from '@nestjs/testing';
import { AppModule, configurationModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { ConfigurationModule } from '@/config/configuration.module';
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

describe('Email controller tests', () => {
  let app;
  let safeConfigUrl;
  let emailDatasource;
  let networkService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, EmailControllerModule],
    })
      .overrideModule(EmailDataSourceModule)
      .useModule(TestEmailDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(configurationModule)
      .useModule(ConfigurationModule.register(configuration))
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

  it('stores email successfully', async () => {
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
    const message = `email-register-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
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
    emailDatasource.saveEmail.mockResolvedValue({
      email: emailAddress,
      verificationCode: faker.string.numeric(),
    });

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress: emailAddress,
        account: account.address,
        timestamp: timestamp,
        signature: signature,
      })
      .expect(201)
      .expect({});
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
    const message = `email-register-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });

    jest.advanceTimersByTime(5 * 60 * 1000);

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress: emailAddress,
        account: account.address,
        timestamp: timestamp,
        signature: signature,
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
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress: emailAddress,
        account: account.address,
        timestamp: timestamp,
        signature: signature,
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
    const message = `email-register-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
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
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress: emailAddress,
        account: account.address,
        timestamp: timestamp,
        signature: signature,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });
});
