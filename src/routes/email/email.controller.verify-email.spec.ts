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
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { Email, EmailAddress } from '@/domain/email/entities/email.entity';

const resendLockWindowMs = 100;
const ttlMs = 1000;

describe('Email controller verify email tests', () => {
  let app;
  let emailDatasource;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const defaultTestConfiguration = configuration();
    const testConfiguration = () => ({
      ...defaultTestConfiguration,
      email: {
        ...defaultTestConfiguration['email'],
        verificationCode: {
          resendLockWindowMs: resendLockWindowMs,
          ttlMs: ttlMs,
        },
      },
    });

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

    emailDatasource = moduleFixture.get(IEmailDataSource);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
  });

  it('verifies email successfully', async () => {
    const chain = chainBuilder().build();
    const account = faker.finance.ethereumAddress();
    const safe = safeBuilder().with('owners', [account]).build();
    const emailAddress = faker.internet.email();
    const verificationCode = faker.string.numeric({ length: 6 });
    const verificationGeneratedOn = new Date();
    const verificationSentOn = new Date();
    emailDatasource.getEmail.mockResolvedValue(<Email>{
      chainId: chain.chainId,
      emailAddress: new EmailAddress(emailAddress),
      isVerified: false,
      safeAddress: safe.address,
      signer: account,
      verificationCode: verificationCode,
      verificationGeneratedOn: verificationGeneratedOn,
      verificationSentOn: verificationSentOn,
    });

    jest.advanceTimersByTime(ttlMs - 1);
    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails/verify`)
      .send({
        account: account,
        code: verificationCode,
      })
      .expect(204)
      .expect({});

    expect(emailDatasource.verifyEmail).toHaveBeenCalledTimes(1);
  });

  it('returns 204 on already verified emails', async () => {
    const chain = chainBuilder().build();
    const account = faker.finance.ethereumAddress();
    const safe = safeBuilder().with('owners', [account]).build();
    const emailAddress = faker.internet.email();
    const verificationCode = faker.string.numeric({ length: 6 });
    const verificationGeneratedOn = new Date();
    const verificationSentOn = new Date();
    emailDatasource.getEmail.mockResolvedValue(<Email>{
      chainId: chain.chainId,
      emailAddress: new EmailAddress(emailAddress),
      isVerified: true,
      safeAddress: safe.address,
      signer: account,
      verificationCode: verificationCode,
      verificationGeneratedOn: verificationGeneratedOn,
      verificationSentOn: verificationSentOn,
    });

    jest.advanceTimersByTime(ttlMs - 1);
    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails/verify`)
      .send({
        account: account,
        code: verificationCode,
      })
      .expect(204)
      .expect({});

    expect(emailDatasource.verifyEmail).toHaveBeenCalledTimes(1);
  });

  it('email verification with expired code returns 400', async () => {
    const chain = chainBuilder().build();
    const account = faker.finance.ethereumAddress();
    const safe = safeBuilder().with('owners', [account]).build();
    const emailAddress = faker.internet.email();
    const verificationCode = faker.string.numeric({ length: 6 });
    const verificationGeneratedOn = new Date();
    const verificationSentOn = new Date();
    emailDatasource.getEmail.mockResolvedValue(<Email>{
      chainId: chain.chainId,
      emailAddress: new EmailAddress(emailAddress),
      isVerified: false,
      safeAddress: safe.address,
      signer: account,
      verificationCode: verificationCode,
      verificationGeneratedOn: verificationGeneratedOn,
      verificationSentOn: verificationSentOn,
    });

    jest.advanceTimersByTime(ttlMs);
    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails/verify`)
      .send({
        account: account,
        code: verificationCode,
      })
      .expect(400)
      .expect({
        message: 'The provided verification code is not valid.',
        statusCode: 400,
      });

    expect(emailDatasource.verifyEmail).toHaveBeenCalledTimes(0);
  });

  it('email verification with wrong code returns 400', async () => {
    const chain = chainBuilder().build();
    const account = faker.finance.ethereumAddress();
    const safe = safeBuilder().with('owners', [account]).build();
    const emailAddress = faker.internet.email();
    const verificationCode = faker.string.numeric({ length: 6 });
    const verificationGeneratedOn = new Date();
    const verificationSentOn = new Date();
    emailDatasource.getEmail.mockResolvedValue(<Email>{
      chainId: chain.chainId,
      emailAddress: new EmailAddress(emailAddress),
      isVerified: false,
      safeAddress: safe.address,
      signer: account,
      verificationCode: verificationCode,
      verificationGeneratedOn: verificationGeneratedOn,
      verificationSentOn: verificationSentOn,
    });

    jest.advanceTimersByTime(ttlMs - 1);
    await request(app.getHttpServer())
      .put(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails/verify`)
      .send({
        account: account,
        code: faker.string.numeric({ length: 6 }),
      })
      .expect(400)
      .expect({
        message: 'The provided verification code is not valid.',
        statusCode: 400,
      });

    expect(emailDatasource.verifyEmail).toHaveBeenCalledTimes(0);
  });
});
