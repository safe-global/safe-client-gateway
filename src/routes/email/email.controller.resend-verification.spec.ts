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
describe('Email controller resend verification tests', () => {
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

  it('resends email verification successfully', async () => {
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

    // Advance timer by the minimum amount of time required to resend email
    jest.advanceTimersByTime(resendLockWindowMs);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/verify-resend`,
      )
      .send({
        account: account,
      })
      .expect(202)
      .expect({});
  });

  it('triggering email resend within lock window returns 429', async () => {
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

    // Advance timer to a time within resendLockWindowMs
    jest.advanceTimersByTime(resendLockWindowMs - 1);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/verify-resend`,
      )
      .send({
        account: account,
      })
      .expect(429);
  });

  it('triggering email resend on verified emails throws 409', async () => {
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

    jest.advanceTimersByTime(resendLockWindowMs);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/verify-resend`,
      )
      .send({
        account: account,
      })
      .expect(409)
      .expect({
        message: `Cannot verify the provided email for the provided account ${account}`,
        statusCode: 409,
      });
  });

  it('resend email with new code', async () => {
    const chain = chainBuilder().build();
    const account = faker.finance.ethereumAddress();
    const safe = safeBuilder().with('owners', [account]).build();
    const emailAddress = faker.internet.email();
    const verificationCode = faker.string.numeric({ length: 6 });
    const newVerificationCode = faker.string.numeric({ length: 6 });
    const verificationGeneratedOn = new Date();
    const verificationSentOn = new Date();
    const email = <Email>{
      chainId: chain.chainId,
      emailAddress: new EmailAddress(emailAddress),
      isVerified: false,
      safeAddress: safe.address,
      signer: account,
      verificationCode: verificationCode,
      verificationGeneratedOn: verificationGeneratedOn,
      verificationSentOn: verificationSentOn,
    };
    emailDatasource.getEmail.mockResolvedValueOnce(email);
    emailDatasource.getEmail.mockResolvedValueOnce({
      ...email,
      verificationCode: newVerificationCode,
    });

    // Advance timer so that code is considered as expired
    jest.advanceTimersByTime(ttlMs);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/verify-resend`,
      )
      .send({
        account: account,
      })
      .expect(202)
      .expect({});

    // TODO 3rd party mock checking that the new code was sent out (and not the old one)
  });

  it('null verificationCode should return 500', async () => {
    const chain = chainBuilder().build();
    const account = faker.finance.ethereumAddress();
    const safe = safeBuilder().with('owners', [account]).build();
    const emailAddress = faker.internet.email();
    const verificationCode = faker.string.numeric({ length: 6 });
    const verificationGeneratedOn = new Date();
    const verificationSentOn = new Date();
    const email = <Email>{
      chainId: chain.chainId,
      emailAddress: new EmailAddress(emailAddress),
      isVerified: false,
      safeAddress: safe.address,
      signer: account,
      verificationCode: verificationCode,
      verificationGeneratedOn: verificationGeneratedOn,
      verificationSentOn: verificationSentOn,
    };
    emailDatasource.getEmail.mockResolvedValueOnce(email);
    emailDatasource.getEmail.mockResolvedValueOnce({
      ...email,
      verificationCode: null,
    });

    jest.advanceTimersByTime(resendLockWindowMs);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/verify-resend`,
      )
      .send({
        account: account,
      })
      .expect(500)
      .expect({ code: 500, message: 'Internal server error' });
  });
});
